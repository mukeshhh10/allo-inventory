import { NextRequest, NextResponse } from "next/server";
import { expireStaleReservations } from "@/lib/reservations";

/**
 * Vercel Cron: runs every minute (configure in vercel.json).
 * Protected by a simple bearer token so it can't be triggered by anyone.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await expireStaleReservations();
    return NextResponse.json({ released, ok: true });
  } catch (err) {
    console.error("[cron/expire]", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
