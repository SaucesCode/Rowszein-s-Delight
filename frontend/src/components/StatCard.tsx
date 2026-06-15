import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx";

type Trend = "up" | "down" | "neutral";
type Accent = "pink" | "green" | "orange" | "red" | "blue";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: Trend;
  accent?: Accent;
  /** Small descriptive icon shown top-left of the card */
  icon?: React.ReactNode;
}

const ACCENT_BORDER: Record<Accent, string> = {
  pink: "border-l-4",
  green: "border-l-4",
  orange: "border-l-4",
  red: "border-l-4",
  blue: "border-l-4",
};

const ACCENT_COLOR: Record<Accent, string> = {
  pink: "#FF6FAE",
  green: "#22C55E",
  orange: "#F59E0B",
  red: "#EF4444",
  blue: "#3B82F6",
};

const TREND_CONFIG: Record<Trend, { icon: React.ElementType; color: string; label: string }> =
  {
    up: { icon: TrendingUp, color: "#15803D", label: "Trending up" },
    down: { icon: TrendingDown, color: "#B91C1C", label: "Trending down" },
    neutral: { icon: Minus, color: "#7C7870", label: "No change" },
  };

export default function StatCard({ label, value, sub, trend, accent, icon }: StatCardProps) {
  const TrendIcon = trend ? TREND_CONFIG[trend].icon : null;

  return (
    <div
      className="card-surface flex flex-col gap-1 p-5 relative overflow-hidden"
      style={accent ? { borderLeft: `4px solid ${ACCENT_COLOR[accent]}` } : undefined}
    >
      {/* Top row: label + optional icon */}
      <div className="flex items-center justify-between mb-1">
        <p className="font-body" style={{ fontSize: 12, color: "#9B6644", fontWeight: 500 }}>
          {label}
        </p>
        {icon && (
          <span
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28,
              height: 28,
              background: accent ? `${ACCENT_COLOR[accent]}18` : "#FFF0F7",
              color: accent ? ACCENT_COLOR[accent] : "#FF6FAE",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      {/* Value */}
      <p
        className="font-heading font-semibold"
        style={{ fontSize: 24, color: "#6B4226", lineHeight: 1.2 }}
      >
        {value}
      </p>

      {/* Trend sub-label */}
      {sub && trend && TrendIcon && (
        <div className="flex items-center gap-1 mt-1">
          <TrendIcon
            size={13}
            style={{ color: TREND_CONFIG[trend].color, flexShrink: 0 }}
            aria-hidden="true"
          />
          <p className="font-body" style={{ fontSize: 12, color: TREND_CONFIG[trend].color }}>
            {sub}
          </p>
        </div>
      )}

      {/* Sub without trend */}
      {sub && !trend && (
        <p className="font-body mt-1" style={{ fontSize: 12, color: "#9B6644" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
