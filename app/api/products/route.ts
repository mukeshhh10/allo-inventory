import { NextResponse } from "next/server";
import { listProducts } from "@/lib/reservations";

export async function GET() {
  try {
    const products = await listProducts();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stockLevels: p.stockLevels.map((s: any) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseLocation: s.warehouse.location,
        total: s.total,
        reserved: s.reserved,
        available: s.total - s.reserved,
      })),
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
