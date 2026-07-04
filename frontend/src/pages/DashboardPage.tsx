import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/hooks/useDashboard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  ShoppingCart,
  Receipt,
  TrendingUp,
  TrendingDown,
  Package,
  Zap,
} from "lucide-react";
import StatCard from "@/components/StatCard";

/* ─────────────────────────────────────────────
   BRAND TOKENS
   Centralized here so the dashboard stops drifting
   from the palette used on the public site. These
   belong in a shared theme file long-term — flagging
   that as a follow-up, not doing it in this pass.
   ───────────────────────────────────────────── */
const BRAND = {
  primaryPink: "#FF6FAE",
  softPink: "#FFD6E7",
  cream: "#FFF8F0",
  chocolate: "#6B4226",
  white: "#FFFDFB",
  textMuted: "#9B6644",
  border: "#E8E6E1",
  chartProfit: "#5B8C3A", // muted success green — same family as StatCard's positive delta
};

type Period = "this_week" | "this_month" | "this_quarter" | "this_year" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "this_week", label: "Week" },
  { value: "this_month", label: "Month" },
  { value: "this_quarter", label: "Quarter" },
  { value: "this_year", label: "Year" },
  { value: "custom", label: "Custom" },
];

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getDateRange(period: Period): { date_from: string; date_to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (period) {
    case "this_week": {
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { date_from: fmt(monday), date_to: fmt(today) };
    }
    case "this_month": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case "this_quarter": {
      const quarter = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), quarter * 3, 1);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case "this_year": {
      const from = new Date(today.getFullYear(), 0, 1);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    default:
      return { date_from: "", date_to: "" };
  }
}

/**
 * Derives a "vs last month" delta from the chart's monthly breakdown, which
 * the API already returns as a fixed Jan–Dec array. This avoids needing a
 * backend change just to show trend context on the KPI cards.
 *
 * Returns undefined when there's no meaningful previous-month baseline
 * (January, or a previous month with zero activity) rather than showing a
 * misleading +infinity% jump.
 */
function computeMonthDelta(
  chartData: { month: string; sales: number; expenses: number; profit: number }[],
  key: "sales" | "expenses" | "profit",
  polarity: "up-is-good" | "down-is-good" = "up-is-good",
) {
  const todayIdx = new Date().getMonth();
  if (todayIdx === 0) return undefined;

  const current = chartData[todayIdx]?.[key] ?? 0;
  const previous = chartData[todayIdx - 1]?.[key] ?? 0;
  if (!previous) return undefined;

  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  const direction: "up" | "down" | "flat" =
    Math.abs(pctChange) < 0.05 ? "flat" : pctChange > 0 ? "up" : "down";

  return {
    value: pctChange,
    direction,
    comparisonLabel: "vs last month",
    polarity,
  };
}

function trailingSparkline(
  chartData: { month: string; sales: number; expenses: number; profit: number }[],
  key: "sales" | "expenses" | "profit",
) {
  const todayIdx = new Date().getMonth();
  const start = Math.max(0, todayIdx - 5);
  const slice = chartData.slice(start, todayIdx + 1);
  return slice.length >= 2 ? slice.map(m => m[key]) : undefined;
}

/* ─────────────────────────────────────────────
   PERIOD SELECTOR — same pill pattern as the
   landing page's CategoryFilter, not a new control
   ───────────────────────────────────────────── */
function PeriodSelector({
  active,
  onChange,
}: {
  active: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select time period">
      {PERIODS.map(p => {
        const isActive = active === p.value;
        return (
          <button
            key={p.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(p.value)}
            className="font-body font-semibold transition-all"
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 999,
              fontSize: 13,
              background: isActive ? BRAND.primaryPink : BRAND.white,
              color: isActive ? BRAND.white : BRAND.chocolate,
              border: isActive ? "none" : `1px solid ${BRAND.border}`,
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SKELETON
   ───────────────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard…" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 16 }}
            className="p-5"
          >
            <div className="skeleton h-3 w-20 mb-4" />
            <div className="skeleton h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-2 h-72 p-6"
          style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 16 }}
        >
          <div className="skeleton h-full" />
        </div>
        <div
          className="h-72 p-6"
          style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 16 }}
        >
          <div className="skeleton h-full" />
        </div>
      </div>
      <span className="sr-only">Loading dashboard, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filters =
    period === "custom" ? { date_from: customFrom, date_to: customTo } : getDateRange(period);

  const { data, isLoading, isError } = useDashboard(filters);

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div
        className="p-8 text-center"
        style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 16 }}
      >
        <p className="font-body text-sm" style={{ color: "#B91C1C" }}>
          Couldn't load the dashboard. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const { totals, best_selling, chart_data, low_stock } = data;

  const netProfitTone = totals.net_profit > 0 ? "positive" : totals.net_profit < 0 ? "negative" : "neutral";
  const hasLowStock = low_stock?.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl" style={{ color: BRAND.chocolate }}>
            Business Overview
          </h2>
          <p className="font-body text-sm mt-1" style={{ color: BRAND.textMuted }}>
            See how the shop is performing this period
          </p>
        </div>
        <PeriodSelector active={period} onChange={setPeriod} />
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 animate-slide-up"
          style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 16 }}
        >
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="font-body text-sm flex-shrink-0" style={{ color: BRAND.textMuted }}>
              From
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="field-input w-full"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="font-body text-sm flex-shrink-0" style={{ color: BRAND.textMuted }}>
              To
            </label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="field-input w-full"
            />
          </div>
        </div>
      )}

      {/* Attention banner — the one place "needs attention" is surfaced */}
      {hasLowStock && (
        <button
          type="button"
          onClick={() => navigate("/ingredients")}
          className="alert-low-stock w-full text-left animate-slide-up cursor-pointer hover:bg-yellow-100 transition-colors"
        >
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
          <div>
            <p className="font-heading font-semibold text-sm">
              {low_stock.length} ingredient{low_stock.length !== 1 ? "s are" : " is"} running low
            </p>
            <p className="font-body text-xs mt-1">
              {low_stock.map((i: any) => i.name).join(", ")}
            </p>
          </div>
        </button>
      )}

      {/* KPI row — the 4 questions the dashboard must answer, nothing more */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total sales"
          value={formatPeso(totals.total_sales)}
          icon={ShoppingCart}
          tone="neutral"
          delta={computeMonthDelta(chart_data, "sales", "up-is-good")}
          sparkline={trailingSparkline(chart_data, "sales")}
        />
        <StatCard
          label="Total expenses"
          value={formatPeso(totals.total_expenses)}
          icon={Receipt}
          tone="neutral"
          delta={computeMonthDelta(chart_data, "expenses", "down-is-good")}
          sparkline={trailingSparkline(chart_data, "expenses")}
        />
        <StatCard
          label="Net profit"
          value={formatPeso(totals.net_profit)}
          icon={totals.net_profit >= 0 ? TrendingUp : TrendingDown}
          tone={netProfitTone}
          delta={computeMonthDelta(chart_data, "profit", "up-is-good")}
          sparkline={trailingSparkline(chart_data, "profit")}
        />
        <StatCard
          label="Low stock items"
          value={low_stock?.length ?? 0}
          icon={Package}
          tone="neutral"
          badgeText={hasLowStock ? "Needs attention" : "All stocked"}
        />
      </div>

      {/* Trend + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend chart */}
        <div
          className="lg:col-span-2 p-6"
          style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 16 }}
        >
          <h3 className="font-heading font-bold text-lg mb-1" style={{ color: BRAND.chocolate }}>
            Monthly trends
          </h3>
          <p className="sr-only">
            Line chart comparing monthly sales, expenses, and profit for the selected period.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart_data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND.primaryPink} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={BRAND.primaryPink} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND.chocolate} stopOpacity={0.14} />
                  <stop offset="95%" stopColor={BRAND.chocolate} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND.chartProfit} stopOpacity={0.16} />
                  <stop offset="95%" stopColor={BRAND.chartProfit} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={BRAND.border} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: BRAND.textMuted, fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: BRAND.textMuted, fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => formatPeso(value)}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  border: `1px solid ${BRAND.border}`,
                  background: BRAND.white,
                  color: BRAND.chocolate,
                  fontFamily: "Inter",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter", color: BRAND.textMuted }} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke={BRAND.primaryPink}
                strokeWidth={2}
                fill="url(#colorSales)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke={BRAND.chocolate}
                strokeWidth={2}
                fill="url(#colorExpenses)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke={BRAND.chartProfit}
                strokeWidth={2}
                fill="url(#colorProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div
          className="p-6"
          style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 16 }}
        >
          <h3 className="font-heading font-bold text-lg mb-5" style={{ color: BRAND.chocolate }}>
            Top products
          </h3>

          {best_selling.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap size={28} style={{ color: BRAND.primaryPink, opacity: 0.4 }} aria-hidden="true" />
              <p className="font-body text-sm mt-3" style={{ color: BRAND.textMuted }}>
                No sales data yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {best_selling.map((item: any, index: number) => (
                <div
                  key={item.product_id}
                  className="flex items-center gap-3 pb-3"
                  style={{
                    borderBottom:
                      index < best_selling.length - 1 ? `1px dashed ${BRAND.border}` : "none",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg font-heading font-bold flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      background: index === 0 ? BRAND.softPink : BRAND.cream,
                      color: index === 0 ? "#E5528A" : BRAND.textMuted,
                      fontSize: 13,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-heading font-semibold text-sm truncate"
                      style={{ color: BRAND.chocolate }}
                    >
                      {item.product_name}
                    </p>
                    <p className="font-body text-xs mt-0.5" style={{ color: BRAND.textMuted }}>
                      {item.total_quantity} sold · {formatPeso(item.total_revenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}