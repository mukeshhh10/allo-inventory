import { NextRequest, NextResponse } from "next/server";
import { createReservation, ConflictError } from "@/lib/reservations";
import { CreateReservationSchema } from "@/lib/schemas";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateReservationSchema.parse(body);
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? undefined;

    const { reservation, created } = await createReservation(
      input,
      idempotencyKey
    );

    return NextResponse.json(reservation, {
      status: created ? 201 : 200,
      headers: idempotencyKey
        ? { "Idempotency-Key": idempotencyKey }
        : undefined,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.flatten() },
        { status: 400 }
      );
    }
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const { getReservation } = await import("@/lib/reservations");
  const reservation = await getReservation(id);
  if (!reservation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(reservation);
}
