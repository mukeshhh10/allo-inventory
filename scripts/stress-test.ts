/**
 * Concurrency stress test for the reservation endpoint.
 *
 * Simulates N simultaneous requests for the same product/warehouse.
 * Exactly one should succeed (if stock = 1), the rest should get 409.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npx tsx scripts/stress-test.ts
 *
 * Options (via env):
 *   BASE_URL      — base URL of the running server (default: http://localhost:3000)
 *   CONCURRENCY   — number of simultaneous requests (default: 20)
 *   PRODUCT_ID    — product to test (default: prod-006 — Samsung Watch, 1 unit in Mumbai)
 *   WAREHOUSE_ID  — warehouse to test (default: wh-mumbai)
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const PRODUCT_ID = process.env.PRODUCT_ID ?? "prod-006";
const WAREHOUSE_ID = process.env.WAREHOUSE_ID ?? "wh-mumbai";

type Result = {
  status: number;
  body: Record<string, unknown>;
  duration: number;
};

async function reserve(): Promise<Result> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 1 }),
  });
  const body = await res.json();
  return { status: res.status, body, duration: Date.now() - start };
}

async function main() {
  console.log("\n🔫 Allo Inventory — Concurrency Stress Test");
  console.log("─".repeat(50));
  console.log(`  Target:      ${BASE_URL}`);
  console.log(`  Product:     ${PRODUCT_ID}`);
  console.log(`  Warehouse:   ${WAREHOUSE_ID}`);
  console.log(`  Concurrency: ${CONCURRENCY} simultaneous requests`);
  console.log("─".repeat(50));

  // Check current stock
  const stockRes = await fetch(`${BASE_URL}/api/products`);
  const products: any[] = await stockRes.json();
  const product = products.find((p) => p.id === PRODUCT_ID);
  if (!product) {
    console.error(`\n❌ Product ${PRODUCT_ID} not found. Run npm run db:seed first.`);
    process.exit(1);
  }
  const stock = product.stockLevels.find((s: any) => s.warehouseId === WAREHOUSE_ID);
  const available = stock?.available ?? 0;

  console.log(`\n  Product:   ${product.name}`);
  console.log(`  Available: ${available} units\n`);

  if (available === 0) {
    console.warn("  ⚠️  No stock available. Test will show all 409s.");
    console.warn("     Reset by running: npm run db:seed\n");
  }

  // Fire all requests simultaneously
  console.log(`  Firing ${CONCURRENCY} simultaneous requests…\n`);
  const promises = Array.from({ length: CONCURRENCY }, () => reserve());
  const results = await Promise.allSettled(promises);

  const settled: Result[] = results.map((r) =>
    r.status === "fulfilled" ? r.value : { status: 0, body: { error: "Network error" }, duration: 0 }
  );

  // Tally
  const successes = settled.filter((r) => r.status === 201 || r.status === 200);
  const conflicts = settled.filter((r) => r.status === 409);
  const errors = settled.filter((r) => r.status >= 500 || r.status === 0);
  const avgDuration = Math.round(settled.reduce((s, r) => s + r.duration, 0) / settled.length);
  const maxDuration = Math.max(...settled.map((r) => r.duration));

  console.log("  Results:");
  console.log(`    ✅ ${successes.length.toString().padStart(3)} succeeded (201/200)`);
  console.log(`    ⚡ ${conflicts.length.toString().padStart(3)} rejected (409 — correct behaviour)`);
  console.log(`    ❌ ${errors.length.toString().padStart(3)} errors   (5xx / network)`);
  console.log(`    ⏱  avg ${avgDuration}ms · max ${maxDuration}ms`);

  const expectedSuccesses = Math.min(available, CONCURRENCY);
  const pass = successes.length === expectedSuccesses && errors.length === 0;

  console.log("\n" + "─".repeat(50));
  if (pass) {
    console.log(`  ✅ PASS — exactly ${successes.length} reservation(s) created, ${conflicts.length} correctly rejected`);
    if (successes.length > 0) {
      const id = (successes[0].body as any).id;
      console.log(`     Reservation ID: ${id}`);
      console.log(`     Confirm: POST ${BASE_URL}/api/reservations/${id}/confirm`);
      console.log(`     Release: POST ${BASE_URL}/api/reservations/${id}/release`);
    }
  } else {
    console.log(`  ❌ FAIL`);
    if (successes.length > expectedSuccesses) {
      console.log(`     Over-reserved: ${successes.length} reservations created for ${available} available units`);
      console.log(`     ↳ This is a race condition bug!`);
    }
    if (errors.length > 0) {
      console.log(`     ${errors.length} server errors occurred`);
      errors.slice(0, 3).forEach((e) => console.log(`     ↳ ${JSON.stringify(e.body)}`));
    }
  }
  console.log("─".repeat(50) + "\n");

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
