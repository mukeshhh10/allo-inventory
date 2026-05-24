/**
 * Reservation service.
 *
 * Concurrency strategy:
 *  1. We acquire an application-level distributed lock (Redis SET NX) keyed on
 *     `product:warehouse` before touching the stock row.  This serialises
 *     concurrent reserve requests for the same SKU/warehouse pair.
 *  2. Inside the lock we read the live stock row and compare
 *     (total - reserved) >= quantity before doing any write.  This is a
 *     "check-then-act" pattern that is safe because the lock ensures mutual
 *     exclusion.
 *  3. All database writes happen inside a Prisma transaction so they are
 *     atomic.  Even without the Redis lock the REPEATABLE READ isolation
 *     Postgres uses for transactions prevents dirty reads; the lock is an
 *     extra defence-in-depth layer and also guards against the TOCTOU race
 *     that can occur even at SERIALIZABLE isolation when two transactions
 *     read the same row concurrently.
 *
 * Expiry:
 *  Lazy cleanup: every read path checks expiresAt and releases stale
 *  reservations automatically.  This means no cron job is needed for
 *  correctness.  A Vercel Cron job (see app/api/cron/expire/route.ts) runs
 *  every minute to proactively reclaim stock so available counts are always
 *  fresh.
 */

import { prisma } from "@/lib/prisma";
import { acquireLock } from "@/lib/redis";
import { CreateReservationInput } from "@/lib/schemas";

const RESERVATION_MINUTES = Number(process.env.RESERVATION_MINUTES ?? 10);

// ─── helpers ────────────────────────────────────────────────────────────────

/** Release all PENDING reservations whose expiresAt is in the past. */
export async function expireStaleReservations(): Promise<number> {
  const now = new Date();

  // Find stale ones first so we can batch-update stock levels.
  const stale = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (stale.length === 0) return 0;

  await prisma.$transaction(async (tx: any) => {
    // Mark them released
    await tx.reservation.updateMany({
      where: { id: { in: stale.map((r: any) => r.id) } },
      data: { status: "RELEASED" },
    });

    // Return reserved units to stock
    for (const r of stale) {
      await tx.stockLevel.updateMany({
        where: { productId: r.productId, warehouseId: r.warehouseId },
        data: { reserved: { decrement: r.quantity } },
      });
    }
  });

  return stale.length;
}

/** Lazily expire a single reservation if it's stale, then return it. */
async function lazyExpire(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) return null;

  if (
    reservation.status === "PENDING" &&
    reservation.expiresAt < new Date()
  ) {
    await prisma.$transaction(async (tx: any) => {
      await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
      });
      await tx.stockLevel.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: { reserved: { decrement: reservation.quantity } },
      });
    });

    return { ...reservation, status: "RELEASED" as const };
  }

  return reservation;
}

// ─── public service functions ────────────────────────────────────────────────

export async function listProducts() {
  // Lazily expire stale reservations so available counts are accurate.
  await expireStaleReservations();

  return prisma.product.findMany({
    include: {
      stockLevels: {
        include: { warehouse: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listWarehouses() {
  return prisma.warehouse.findMany({ orderBy: { name: "asc" } });
}

export async function createReservation(
  input: CreateReservationInput,
  idempotencyKey?: string
): Promise<{ reservation: Awaited<ReturnType<typeof getReservation>>; created: boolean }> {
  const { productId, warehouseId, quantity } = input;

  // ── idempotency check (before acquiring the lock) ──────────────────────
  if (idempotencyKey) {
    const existing = await prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
      include: {
        reservation: { include: { product: true, warehouse: true } },
      },
    });
    if (existing) {
      return { reservation: existing.reservation as any, created: false };
    }
  }

  // ── distributed lock ───────────────────────────────────────────────────
  const lockKey = `stock:${productId}:${warehouseId}`;
  const lock = await acquireLock(lockKey, 15_000);

  if (!lock.acquired) {
    throw new ConflictError(
      "Another request is updating this stock — please retry."
    );
  }

  try {
    // ── check availability (inside the lock) ─────────────────────────────
    // Also expire stale reservations now to maximise available stock.
    await expireStaleReservations();

    const stock = await prisma.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!stock || stock.total - stock.reserved < quantity) {
      throw new ConflictError("Not enough stock available.");
    }

    // ── create reservation + update stock (atomic transaction) ────────────
    const expiresAt = new Date(
      Date.now() + RESERVATION_MINUTES * 60 * 1_000
    );

    const reservation = await prisma.$transaction(async (tx: any) => {
      const res = await tx.reservation.create({
        data: { productId, warehouseId, quantity, status: "PENDING", expiresAt },
        include: { product: true, warehouse: true },
      });

      await tx.stockLevel.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { increment: quantity } },
      });

      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            reservationId: res.id,
            responseBody: res as any,
          },
        });
      }

      return res;
    });

    return { reservation: reservation as any, created: true };
  } finally {
    await lock.release();
  }
}

export async function confirmReservation(id: string) {
  const reservation = await lazyExpire(id);

  if (!reservation) throw new NotFoundError("Reservation not found.");
  if (reservation.status === "RELEASED" || reservation.status === "CONFIRMED") {
    if (reservation.expiresAt < new Date() && reservation.status === "RELEASED") {
      throw new GoneError("Reservation has expired.");
    }
    if (reservation.status === "CONFIRMED") return reservation;
    throw new GoneError("Reservation has already been released.");
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const res = await tx.reservation.update({
      where: { id },
      data: { status: "CONFIRMED" },
      include: { product: true, warehouse: true },
    });

    // Confirmed = stock is permanently decremented.
    // reserved counter goes back to 0, total decrements.
    await tx.stockLevel.updateMany({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
      },
      data: {
        reserved: { decrement: reservation.quantity },
        total: { decrement: reservation.quantity },
      },
    });

    return res;
  });

  return updated;
}

export async function releaseReservation(id: string) {
  const reservation = await lazyExpire(id);

  if (!reservation) throw new NotFoundError("Reservation not found.");
  if (reservation.status === "RELEASED") return reservation;
  if (reservation.status === "CONFIRMED") {
    throw new ConflictError("Cannot release a confirmed reservation.");
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const res = await tx.reservation.update({
      where: { id },
      data: { status: "RELEASED" },
      include: { product: true, warehouse: true },
    });

    await tx.stockLevel.updateMany({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
      },
      data: { reserved: { decrement: reservation.quantity } },
    });

    return res;
  });

  return updated;
}

export async function getReservation(id: string) {
  return lazyExpire(id);
}

// ─── errors ─────────────────────────────────────────────────────────────────

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class GoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoneError";
  }
}
