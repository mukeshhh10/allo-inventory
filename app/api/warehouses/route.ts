import { NextResponse } from "next/server";
import { listWarehouses } from "@/lib/reservations";

export async function GET() {
  try {
    const warehouses = await listWarehouses();
    return NextResponse.json(warehouses);
  } catch (err) {
    console.error("[GET /api/warehouses]", err);
    return NextResponse.json(
      { error: "Failed to fetch warehouses" },
      { status: 500 }
    );
  }
}
