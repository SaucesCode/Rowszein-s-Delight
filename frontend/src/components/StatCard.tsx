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

const ACCENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pink: { bg: "#fce7f3", text: "#ec4899", border: "#fbcfe8" },
  blue: { bg: "#eff6ff", text: "#3b82f6", border: "#dbeafe" },
  green: { bg: "#ecfdf5", text: "#10b981", border: "#d1fae5" },
  orange: { bg: "#fff7ed", text: "#f59e0b", border: "#fed7aa" },
  red: { bg: "#fef2f2", text: "#ef4444", border: "#fecaca" },
  purple: { bg: "#f3e8ff", text: "#a855f7", border: "#e9d5ff" },
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
      className="premium-card"
      style={{
        borderLeft: `3px solid ${colors.border}`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p
            className="font-body text-xs font-semibold uppercase tracking-wide"
            style={{ color: "#64748b", marginBottom: 8 }}
          >
            {label}
          </p>
          <p
            className="font-heading font-bold"
            style={{ fontSize: 28, color: "#0f172a", lineHeight: 1.1 }}
          >
            {value}
          </p>
          {sub && (
            <p
              className="font-body text-xs mt-3"
              style={{ color: "#94a3b8" }}
            >
              {sub}
            </p>
          )}
        </div>

        {icon && (
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              background: colors.bg,
              color: colors.text,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-gray-100">
          {trend === "up" && (
            <>
              <TrendingUp size={14} strokeWidth={2.5} style={{ color: "#10b981" }} />
              <span className="font-body text-xs font-semibold" style={{ color: "#10b981" }}>
                Trending up
              </span>
            </>
          )}
          {trend === "down" && (
            <>
              <TrendingDown size={14} strokeWidth={2.5} style={{ color: "#ef4444" }} />
              <span className="font-body text-xs font-semibold" style={{ color: "#ef4444" }}>
                Trending down
              </span>
            </>
          )}
          {trend === "neutral" && (
            <span className="font-body text-xs font-semibold" style={{ color: "#64748b" }}>
              No change
            </span>
          )}
        </div>
      )}
    </div>
  );
}
