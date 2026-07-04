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

const ACCENT_COLORS: Record<string, { gradient: string; text: string; light: string }> = {
  pink: {
    gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
    text: "#ec4899",
    light: "#fce7f3",
  },
  blue: {
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
    text: "#3b82f6",
    light: "#eff6ff",
  },
  green: {
    gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
    text: "#10b981",
    light: "#ecfdf5",
  },
  orange: {
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    text: "#f59e0b",
    light: "#fff7ed",
  },
  red: {
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    text: "#ef4444",
    light: "#fef2f2",
  },
  purple: {
    gradient: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
    text: "#a855f7",
    light: "#f3e8ff",
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
      className="premium-card relative overflow-hidden group cursor-default"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "0.875rem",
        padding: "1.5rem",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = colors.text;
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 8px 24px ${colors.text}15`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.06)";
      }}
    >
      {/* Gradient accent bar (top-left) */}
      <div
        className="absolute top-0 left-0 w-1 h-12"
        style={{ background: colors.gradient }}
      />

      {/* Content */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p
            className="font-body text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#94a3b8", marginBottom: 12 }}
          >
            {label}
          </p>
          <p
            className="font-heading font-bold"
            style={{ fontSize: 32, color: "#0f172a", lineHeight: 1.1, marginBottom: 8 }}
          >
            {value}
          </p>
          {sub && (
            <p
              className="font-body text-xs"
              style={{ color: "#64748b" }}
            >
              {sub}
            </p>
          )}
        </div>

        {icon && (
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              background: colors.light,
              color: colors.text,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Trend indicator */}
      {trend && (
        <div
          className="flex items-center gap-1.5 mt-4 pt-4"
          style={{ borderTop: "1px solid #e2e8f0" }}
        >
          {trend === "up" && (
            <>
              <TrendingUp size={14} strokeWidth={2.5} style={{ color: "#10b981" }} />
              <span className="font-body text-xs font-semibold" style={{ color: "#10b981" }}>
                +12.5% vs last month
              </span>
            </>
          )}
          {trend === "down" && (
            <>
              <TrendingDown size={14} strokeWidth={2.5} style={{ color: "#ef4444" }} />
              <span className="font-body text-xs font-semibold" style={{ color: "#ef4444" }}>
                -8.2% vs last month
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
