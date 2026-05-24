-- Allo Inventory — Initial Migration
-- Run: psql $DATABASE_URL -f prisma/sql/001_init.sql
-- (Alternatively use: npx prisma migrate dev --name init)

CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RELEASED');

CREATE TABLE "Product" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "description" TEXT,
    "imageUrl"    TEXT,
    "price"       DOUBLE PRECISION NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warehouse" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "location"  TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockLevel" (
    "id"          TEXT NOT NULL,
    "productId"   TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "total"       INTEGER NOT NULL DEFAULT 0,
    "reserved"    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockLevel_productId_warehouseId_key"
    ON "StockLevel"("productId", "warehouseId");

CREATE TABLE "Reservation" (
    "id"          TEXT                NOT NULL,
    "productId"   TEXT                NOT NULL,
    "warehouseId" TEXT                NOT NULL,
    "quantity"    INTEGER             NOT NULL,
    "status"      "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt"   TIMESTAMP(3)        NOT NULL,
    "createdAt"   TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- Index for fast expiry queries
CREATE INDEX "Reservation_status_expiresAt_idx"
    ON "Reservation"("status", "expiresAt");

CREATE TABLE "IdempotencyRecord" (
    "id"            TEXT         NOT NULL,
    "key"           TEXT         NOT NULL,
    "reservationId" TEXT         NOT NULL,
    "responseBody"  JSONB        NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");

-- Foreign keys
ALTER TABLE "StockLevel"
    ADD CONSTRAINT "StockLevel_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockLevel"
    ADD CONSTRAINT "StockLevel_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdempotencyRecord"
    ADD CONSTRAINT "IdempotencyRecord_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
