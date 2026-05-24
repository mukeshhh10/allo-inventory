# Allo Inventory — Take-Home Exercise

A Next.js inventory reservation platform solving the checkout race condition for multi-warehouse retail.

**Live demo:** _deploy and update this_

---

## What's Built

| Feature | Status |
|---------|--------|
| Product listing with per-warehouse stock | ✅ |
| Reserve endpoint (concurrency-safe) | ✅ |
| Confirm / release endpoints | ✅ |
| 410 on expired reservation | ✅ |
| 409 on insufficient stock | ✅ |
| Live countdown timer on checkout page | ✅ |
| Real-time UI updates (no page refresh) | ✅ |
| Lazy expiry on every read | ✅ |
| Vercel Cron for proactive expiry | ✅ |
| Idempotency via Idempotency-Key header | ✅ |
| Distributed locking via Redis | ✅ |
| In-memory lock fallback (dev, no Redis needed) | ✅ |

---

## Running Locally

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
REDIS_URL="redis://default:password@host:port"   # optional for dev
RESERVATION_MINUTES=10
CRON_SECRET="some-random-secret"
```

> No Redis? The app has an in-memory fallback for single-instance dev.

### 3. Migrate and seed

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

---

## Deployment (Vercel + Supabase/Neon + Upstash)

1. Create a Postgres DB at supabase.com or neon.tech
2. Create a Redis DB at upstash.com
3. Set env vars in Vercel dashboard
4. `npx vercel --prod`
5. Run `prisma migrate deploy` and `npm run db:seed` against hosted DB

The `vercel.json` configures a cron at `/api/cron/expire` every minute.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/products | Products with available stock |
| GET | /api/warehouses | All warehouses |
| POST | /api/reservations | Reserve units (409 if stock low) |
| POST | /api/reservations/:id/confirm | Confirm purchase (410 if expired) |
| POST | /api/reservations/:id/release | Cancel reservation |

**Idempotency:** Pass `Idempotency-Key: <uuid>` on POST /api/reservations to safely retry.

---

## Concurrency Strategy

**Two-layer approach:**

**Layer 1 — Redis distributed lock (SET NX)**
Before reading or writing stock, we acquire a lock keyed on `stock:{productId}:{warehouseId}`. Redis `SET NX` is atomic — exactly one concurrent caller wins. All others get a 409 immediately without touching the DB. Lock has a 15s TTL + explicit release in a `finally` block.

**Layer 2 — Postgres transaction**
Inside the lock: read live stock, check availability, then create reservation + increment `reserved` in a single `$transaction`. This is REPEATABLE READ — no dirty reads even without the Redis lock. Redis is defence-in-depth for multi-instance deployments.

**Fallback:** Without `REDIS_URL`, an in-memory `Map` provides locking. Safe for single-instance dev; not safe for horizontally scaled production.

---

## Expiry Mechanism

Reservations expire at `now + RESERVATION_MINUTES * 60s`.

**Lazy expiry:** Every read path calls `lazyExpire()` which checks `expiresAt` and atomically releases stale reservations. Stock is always accurate at read time.

**Vercel Cron:** `/api/cron/expire` runs every minute (via vercel.json) to bulk-release stale reservations proactively. Needed so product listings show fresh available counts.

---

## Idempotency (Bonus)

On `POST /api/reservations` with `Idempotency-Key: <uuid>`:
1. Check `IdempotencyRecord` table before acquiring any lock
2. If found → return original response (200, not 201)
3. If not found → create reservation + write `IdempotencyRecord` inside the same DB transaction

Result: retrying a failed request never double-books.

---

## Data Model

```
Product
  StockLevel (productId+warehouseId unique)
    total     = physical units on hand
    reserved  = units held by PENDING reservations
    available = total - reserved
  Reservation (status: PENDING | CONFIRMED | RELEASED)

On confirm:  reserved -= qty, total -= qty   (permanently sold)
On release:  reserved -= qty                 (units return to pool)
```

---

## Trade-offs

- **Quantity fixed at 1 in UI** — API supports any positive integer
- **No user auth** — reservations are anonymous; add session/JWT for prod
- **No payment integration** — Confirm button simulates success
- **No real-time push** — SSE/WebSockets would be better for multi-tab sync

## What I'd Add

- DB-level optimistic lock: `UPDATE ... WHERE total - reserved >= qty RETURNING *` — eliminates read-then-write without Redis
- Rate limiting on reserve endpoint
- Retry logic for `$transaction` serialization failures at high traffic
- Admin dashboard, reservation history, webhooks on expiry
