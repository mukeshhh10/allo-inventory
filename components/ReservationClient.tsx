"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ReservationData {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string | null;
  };
  warehouse?: {
    id: string;
    name: string;
    location: string;
  };
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function useCountdown(expiresAt: string, status: string) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (status !== "PENDING") return;

    function tick() {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setRemaining(diff);
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, status]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const pct =
    status !== "PENDING"
      ? 0
      : remaining /
        Math.max(
          1,
          Math.floor(
            (new Date(expiresAt).getTime() -
              new Date(expiresAt).getTime() +
              600_000) /
              1000
          )
        );

  return { remaining, minutes, seconds };
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    PENDING: { color: "var(--yellow)", label: "Pending" },
    CONFIRMED: { color: "var(--green)", label: "Confirmed" },
    RELEASED: { color: "var(--red)", label: "Released" },
  }[status] ?? { color: "var(--text-muted)", label: status };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontFamily: "var(--font-mono)",
        color: config.color,
        background: `${config.color}18`,
        padding: "4px 12px",
        borderRadius: 6,
        border: `1px solid ${config.color}40`,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.color,
        }}
      />
      {config.label}
    </span>
  );
}

export default function ReservationClient({ id }: { id: string }) {
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<
    "confirm" | "release" | null
  >(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations?id=${id}`);
      if (!res.ok) {
        setFetchError("Reservation not found.");
        return;
      }
      const data = await res.json();
      setReservation(data);
    } catch {
      setFetchError("Failed to load reservation.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const { remaining, minutes, seconds } = useCountdown(
    reservation?.expiresAt ?? new Date().toISOString(),
    reservation?.status ?? "RELEASED"
  );

  // Auto-refresh status when timer hits 0
  useEffect(() => {
    if (remaining === 0 && reservation?.status === "PENDING") {
      const t = setTimeout(fetchReservation, 1500);
      return () => clearTimeout(t);
    }
  }, [remaining, reservation?.status, fetchReservation]);

  async function handleAction(action: "confirm" | "release") {
    setActionLoading(action);
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${id}/${action}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        const code = res.status;
        if (code === 410) {
          setActionError("This reservation has expired — the hold has been released.");
        } else if (code === 409) {
          setActionError(data.error ?? "Conflict.");
        } else {
          setActionError(data.error ?? "Something went wrong.");
        }
        // Refresh to get latest status anyway
        await fetchReservation();
        return;
      }

      setReservation(data);
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  const EMOJI_MAP: Record<string, string> = {
    "prod-001": "🎧",
    "prod-002": "📱",
    "prod-003": "👟",
    "prod-004": "📖",
    "prod-005": "🌀",
    "prod-006": "⌚",
  };

  if (loading) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "80px auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {[120, 280, 80].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 16, border: "1px solid var(--border)" }}
            className="skeleton"
          />
        ))}
      </div>
    );
  }

  if (fetchError || !reservation) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "80px auto",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Not Found
        </h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
          {fetchError ?? "This reservation doesn't exist."}
        </p>
        <button
          onClick={() => router.push("/")}
          style={btnStyle("var(--accent)")}
        >
          ← Back to Products
        </button>
      </div>
    );
  }

  const isExpired =
    reservation.status === "PENDING" && remaining === 0;
  const isPending = reservation.status === "PENDING" && !isExpired;
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED" || isExpired;

  const timerPct =
    isPending
      ? Math.min(1, remaining / 600) // 600s = 10 min
      : 0;

  const timerColor =
    remaining > 120
      ? "var(--green)"
      : remaining > 60
      ? "var(--yellow)"
      : "var(--red)";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 32,
          padding: 0,
          fontFamily: "var(--font-body)",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.color = "var(--text)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
        }
      >
        ← Products
      </button>

      {/* Title */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          Reservation
        </h1>
        <div
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          {reservation.id}
        </div>
        <StatusBadge status={isExpired ? "RELEASED" : reservation.status} />
      </div>

      {/* Product card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              flexShrink: 0,
            }}
          >
            {EMOJI_MAP[reservation.productId] ?? "📦"}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {reservation.product?.name ?? "Product"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {reservation.warehouse?.name} · {reservation.warehouse?.location}
            </div>
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {reservation.product
              ? formatPrice(reservation.product.price * reservation.quantity)
              : "—"}
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 24,
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: "var(--text-muted)" }}>Qty </span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {reservation.quantity}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Unit price </span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {reservation.product
                ? formatPrice(reservation.product.price)
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Countdown timer (pending only) */}
      {isPending && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Time remaining
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 28,
                fontWeight: 500,
                color: timerColor,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 4,
              background: "var(--surface-2)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${timerPct * 100}%`,
                background: timerColor,
                borderRadius: 2,
                transition: "width 1s linear",
              }}
            />
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div
          style={{
            background: "rgba(255,77,106,0.1)",
            border: "1px solid rgba(255,77,106,0.3)",
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 14,
            color: "var(--red)",
            marginBottom: 20,
          }}
        >
          ⚠ {actionError}
        </div>
      )}

      {/* Success states */}
      {isConfirmed && (
        <div
          style={{
            background: "rgba(0,217,163,0.1)",
            border: "1px solid rgba(0,217,163,0.3)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--green)",
              marginBottom: 4,
            }}
          >
            Purchase Confirmed!
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Your order is being processed. Thank you!
          </div>
        </div>
      )}

      {isReleased && (
        <div
          style={{
            background: "rgba(255,77,106,0.1)",
            border: "1px solid rgba(255,77,106,0.3)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔓</div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--red)",
              marginBottom: 4,
            }}
          >
            {isExpired ? "Reservation Expired" : "Reservation Released"}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {isExpired
              ? "Your hold has expired. Please start a new reservation."
              : "The reservation was cancelled and stock returned."}
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={() => handleAction("confirm")}
            disabled={!!actionLoading}
            style={btnStyle("var(--green)", !!actionLoading)}
          >
            {actionLoading === "confirm" ? (
              <>
                <Spinner /> Processing…
              </>
            ) : (
              "✓ Confirm Purchase"
            )}
          </button>
          <button
            onClick={() => handleAction("release")}
            disabled={!!actionLoading}
            style={btnStyle("transparent", !!actionLoading, {
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            })}
          >
            {actionLoading === "release" ? (
              <>
                <Spinner /> Cancelling…
              </>
            ) : (
              "Cancel Reservation"
            )}
          </button>
        </div>
      )}

      {(isConfirmed || isReleased) && (
        <button onClick={() => router.push("/")} style={btnStyle("var(--accent)")}>
          ← Browse Products
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
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
  );
}

function btnStyle(
  bg: string,
  disabled = false,
  extra: Record<string, string> = {}
): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 20px",
    borderRadius: 10,
    border: "none",
    background: bg,
    color: bg === "transparent" ? "var(--text-muted)" : "white",
    fontFamily: "var(--font-display)",
    fontSize: 16,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "opacity 0.2s",
    ...extra,
  };
}
