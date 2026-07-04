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
  pink: {
    bg: "#fbcfe8",
    text: "#ec4899",
    border: "#ec4899",
  },
  blue: {
    bg: "#dbeafe",
    text: "#3b82f6",
    border: "#3b82f6",
  },
  green: {
    bg: "#d1fae5",
    text: "#10b981",
    border: "#10b981",
  },
  orange: {
    bg: "#fed7aa",
    text: "#f59e0b",
    border: "#f59e0b",
  },
  red: {
    bg: "#fecaca",
    text: "#ef4444",
    border: "#ef4444",
  },
  purple: {
    bg: "#e9d5ff",
    text: "#a855f7",
    border: "#a855f7",
  },
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
      className="bento-card"
      style={{
        borderLeft: `4px solid ${colors.border}`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="font-body text-sm font-medium"
            style={{ color: "#6b7280", marginBottom: 8 }}
          >
            {label}
          </p>
          <p
            className="font-heading font-bold"
            style={{ fontSize: 28, color: "#111827", lineHeight: 1.1 }}
          >
            {value}
          </p>
          {sub && (
            <p
              className="font-body text-xs mt-2"
              style={{ color: "#9ca3af" }}
            >
              {sub}
            </p>
          )}
        </div>

        {icon && (
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 44,
              height: 44,
              background: colors.bg,
              color: colors.text,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="flex items-center gap-1 mt-4 pt-4 border-t border-gray-100">
          {trend === "up" && (
            <>
              <TrendingUp size={14} strokeWidth={2.5} style={{ color: "#10b981" }} />
              <span className="font-body text-xs font-medium" style={{ color: "#10b981" }}>
                Trending up
              </span>
            </>
          )}
          {trend === "down" && (
            <>
              <TrendingDown size={14} strokeWidth={2.5} style={{ color: "#ef4444" }} />
              <span className="font-body text-xs font-medium" style={{ color: "#ef4444" }}>
                Trending down
              </span>
            </>
          )}
          {trend === "neutral" && (
            <span className="font-body text-xs font-medium" style={{ color: "#6b7280" }}>
              No change
            </span>
          )}
        </div>
      )}
    </div>
  );
}
