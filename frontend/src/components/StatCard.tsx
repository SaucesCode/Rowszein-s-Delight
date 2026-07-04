import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  accent?: "pink" | "blue" | "green" | "orange" | "red" | "purple";
  icon?: ReactNode;
}

const ACCENT_COLORS: Record<string, { color: string; bg: string }> = {
  pink: { color: "#ec4899", bg: "#fce7f3" },
  blue: { color: "#3b82f6", bg: "#eff6ff" },
  green: { color: "#10b981", bg: "#ecfdf5" },
  orange: { color: "#f59e0b", bg: "#fff7ed" },
  red: { color: "#ef4444", bg: "#fef2f2" },
  purple: { color: "#a855f7", bg: "#f3e8ff" },
};

export default function StatCard({
  label,
  value,
  sub,
  trend,
  accent = "pink",
  icon,
}: StatCardProps) {
  const colors = ACCENT_COLORS[accent];

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
      style={{
        minHeight: 160,
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: colors.color }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Label */}
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "#94a3b8", marginBottom: 8 }}
          >
            {label}
          </p>

          {/* Value */}
          <p
            className="font-heading font-bold"
            style={{ fontSize: 32, color: "#0f172a", lineHeight: 1.1, marginBottom: 12 }}
          >
            {value}
          </p>

          {/* Sub text or trend */}
          {sub && !trend && (
            <p className="text-xs" style={{ color: "#64748b" }}>
              {sub}
            </p>
          )}

          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              {trend === "up" && (
                <>
                  <TrendingUp size={13} strokeWidth={2.5} style={{ color: "#10b981" }} />
                  <span className="text-xs font-semibold" style={{ color: "#10b981" }}>
                    {sub || "Trending up"}
                  </span>
                </>
              )}
              {trend === "down" && (
                <>
                  <TrendingDown size={13} strokeWidth={2.5} style={{ color: "#ef4444" }} />
                  <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                    {sub || "Trending down"}
                  </span>
                </>
              )}
              {trend === "neutral" && (
                <span className="text-xs font-semibold" style={{ color: "#64748b" }}>
                  {sub || "No change"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 56,
              height: 56,
              background: colors.bg,
              color: colors.color,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
