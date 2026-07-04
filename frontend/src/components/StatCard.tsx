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
  /** Small descriptive icon shown top-right of the card */
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

const ACCENT_BG: Record<Accent, string> = {
  pink: "#FFF0F7",
  green: "#F0FDF4",
  orange: "#FFF7ED",
  red: "#FEF2F2",
  blue: "#EFF6FF",
};

const TREND_CONFIG: Record<Trend, { icon: React.ElementType; color: string; label: string }> =
  {
    up: { icon: TrendingUp, color: "#15803D", label: "Trending up" },
    down: { icon: TrendingDown, color: "#B91C1C", label: "Trending down" },
    neutral: { icon: Minus, color: "#7C7870", label: "No change" },
  };

export default function StatCard({ label, value, sub, trend, accent, icon }: StatCardProps) {
  const TrendIcon = trend ? TREND_CONFIG[trend].icon : null;
  const bgColor = accent ? ACCENT_BG[accent] : "#FFF0F7";
  const accentColorValue = accent ? ACCENT_COLOR[accent] : "#FF6FAE";

  return (
    <div
      className="card-surface flex flex-col gap-3 p-6 relative overflow-hidden hover-lift"
      style={accent ? { borderLeft: `5px solid ${accentColorValue}` } : undefined}
    >
      {/* Top row: label + optional icon */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-body text-xs font-medium" style={{ color: "#9B6644" }}>
            {label}
          </p>
        </div>
        {icon && (
          <span
            className="flex items-center justify-center rounded-lg flex-shrink-0 ml-3"
            style={{
              width: 36,
              height: 36,
              background: bgColor,
              color: accentColorValue,
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
        style={{ fontSize: 28, color: "#6B4226", lineHeight: 1.2 }}
      >
        {value}
      </p>

      {/* Trend sub-label */}
      {sub && trend && TrendIcon && (
        <div className="flex items-center gap-1.5 mt-1">
          <TrendIcon
            size={14}
            style={{ color: TREND_CONFIG[trend].color, flexShrink: 0 }}
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <p className="font-body text-xs" style={{ color: TREND_CONFIG[trend].color }}>
            {sub}
          </p>
        </div>
      )}

      {/* Sub without trend */}
      {sub && !trend && (
        <p className="font-body text-xs mt-1" style={{ color: "#9B6644" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
