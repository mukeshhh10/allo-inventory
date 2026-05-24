"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface StockLevel {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stockLevels: StockLevel[];
}

const EMOJI_MAP: Record<string, string> = {
  "prod-001": "🎧",
  "prod-002": "📱",
  "prod-003": "👟",
  "prod-004": "📖",
  "prod-005": "🌀",
  "prod-006": "⌚",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function StockBadge({ available, total }: { available: number; total: number }) {
  const pct = total === 0 ? 0 : available / total;
  const color =
    available === 0
      ? "var(--red)"
      : pct <= 0.2
      ? "var(--yellow)"
      : "var(--green)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color,
        background: `${color}18`,
        padding: "2px 8px",
        borderRadius: 4,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {available === 0 ? "Out of stock" : `${available} left`}
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    product.stockLevels[0]?.warehouseId ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stock = product.stockLevels.find(
    (s) => s.warehouseId === selectedWarehouse
  );
  const canReserve = (stock?.available ?? 0) > 0;
  const emoji = EMOJI_MAP[product.id] ?? "📦";

  const totalAvailable = product.stockLevels.reduce(
    (sum, s) => sum + s.available,
    0
  );

  async function handleReserve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not reserve. Please try again.");
        return;
      }

      router.push(`/reservations/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s, transform 0.2s",
        animation: "fadeUp 0.4s ease forwards",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Product header */}
      <div
        style={{
          padding: 28,
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            flexShrink: 0,
          }}
        >
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 4,
              lineHeight: 1.3,
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.description}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Price + total stock */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 800,
              color: "var(--text)",
            }}
          >
            {formatPrice(product.price)}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {totalAvailable} units total
          </span>
        </div>

        {/* Warehouse selector */}
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Warehouse
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {product.stockLevels.map((s) => (
              <button
                key={s.warehouseId}
                onClick={() => setSelectedWarehouse(s.warehouseId)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${
                    selectedWarehouse === s.warehouseId
                      ? "var(--accent)"
                      : "var(--border)"
                  }`,
                  background:
                    selectedWarehouse === s.warehouseId
                      ? "rgba(108,71,255,0.08)"
                      : "transparent",
                  cursor: "pointer",
                  color: "var(--text)",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.warehouseName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    {s.warehouseLocation}
                  </div>
                </div>
                <StockBadge available={s.available} total={s.total} />
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(255,77,106,0.1)",
              border: "1px solid rgba(255,77,106,0.3)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--red)",
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleReserve}
          disabled={!canReserve || loading}
          style={{
            marginTop: "auto",
            padding: "13px 20px",
            borderRadius: 10,
            border: "none",
            background: canReserve
              ? "var(--accent)"
              : "var(--surface-2)",
            color: canReserve ? "white" : "var(--text-muted)",
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            cursor: canReserve ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => {
            if (canReserve)
              (e.currentTarget as HTMLElement).style.opacity = "0.88";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "white",
                  display: "inline-block",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              Reserving…
            </>
          ) : canReserve ? (
            "Reserve Now →"
          ) : (
            "Out of Stock"
          )}
        </button>
      </div>
    </div>
  );
}

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load products. Please refresh.");
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 12,
            background: "rgba(108,71,255,0.1)",
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px solid rgba(108,71,255,0.2)",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent)",
              animation: "pulse-ring 1.5s ease infinite",
            }}
          />
          Live Inventory
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 12,
          }}
        >
          Products
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, maxWidth: 480 }}>
          Select a product and warehouse to reserve your units. Reservations
          hold stock for{" "}
          <span style={{ color: "var(--text)" }}>10 minutes</span> while you
          complete checkout.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 24,
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 420,
                borderRadius: 16,
                border: "1px solid var(--border)",
              }}
              className="skeleton"
            />
          ))}
        </div>
      ) : error ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 24px",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, marginBottom: 8, color: "var(--text)" }}>
            Something went wrong
          </div>
          <div>{error}</div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 24,
          }}
        >
          {products.map((product, i) => (
            <div
              key={product.id}
              style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
              className="animate-fade-up"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
