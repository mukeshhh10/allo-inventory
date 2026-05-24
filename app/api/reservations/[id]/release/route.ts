import { NextRequest, NextResponse } from "next/server";
import { releaseReservation, NotFoundError, ConflictError } from "@/lib/reservations";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const reservation = await releaseReservation(id);
    return NextResponse.json(reservation);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(`[POST /api/reservations/${id}/release]`, err);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
