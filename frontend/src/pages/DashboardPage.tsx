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
  Minus,
} from "lucide-react";
import StatCard from "@/components/StatCard";

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */
type Period = "this_week" | "this_month" | "this_quarter" | "this_year" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
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

/* ─────────────────────────────────────────────
   SKELETON — dashboard-specific
   ───────────────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard…" className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card-surface p-5">
            <div
              className="skeleton mb-2"
              style={{ height: 11, width: "45%", borderRadius: 5 }}
            />
            <div className="skeleton" style={{ height: 22, width: "60%", borderRadius: 6 }} />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="card-surface p-5">
        <div className="skeleton mb-4" style={{ height: 14, width: 140, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 8 }} />
      </div>
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION LABEL
   ───────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-heading font-semibold uppercase tracking-wide mb-3"
      style={{ fontSize: 10, color: "#9B6644", letterSpacing: "0.07em" }}
    >
      {children}
    </p>
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
      <div className="card-surface p-8 text-center">
        <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
          Failed to load dashboard. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const { totals, this_month, best_selling, chart_data, low_stock } = data;

  const profitTrend =
    this_month.profit > 0 ? "up" : this_month.profit < 0 ? "down" : "neutral";

  const totalsTrend =
    totals.net_profit > 0 ? "up" : totals.net_profit < 0 ? "down" : "neutral";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Period picker ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="font-heading font-semibold"
            style={{ fontSize: 20, color: "#6B4226" }}
          >
            Dashboard
          </h1>
          <p className="font-body mt-0.5" style={{ fontSize: 13, color: "#9B6644" }}>
            Business performance overview
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="font-body transition-colors"
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                border: period === p.value ? "none" : "1px solid #E8E6E1",
                background:
                  period === p.value
                    ? "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)"
                    : "#FFFDFB",
                color: period === p.value ? "#FFFFFF" : "#5A5650",
                cursor: "pointer",
                boxShadow: period === p.value ? "0 2px 8px rgba(255,111,174,0.30)" : "none",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 animate-slide-up"
          style={{
            background: "#FFFDFB",
            border: "1px solid #E8E6E1",
            borderRadius: 10,
          }}
        >
          <div className="flex items-center gap-2">
            <label className="font-body" style={{ fontSize: 13, color: "#7C7870" }}>
              From
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="field-input"
              style={{ width: "auto" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-body" style={{ fontSize: 13, color: "#7C7870" }}>
              To
            </label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="field-input"
              style={{ width: "auto" }}
            />
          </div>
          {customFrom && customTo && (
            <p className="font-body" style={{ fontSize: 12, color: "#A8A49B" }}>
              {customFrom} → {customTo}
            </p>
          )}
        </div>
      )}

      {/* ── Low stock alert ── */}
      {low_stock?.length > 0 && (
        <button
          type="button"
          onClick={() => navigate("/ingredients")}
          className="alert-low-stock w-full text-left animate-slide-up"
          style={{ cursor: "pointer" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-heading font-semibold" style={{ fontSize: 13 }}>
              {low_stock.length} ingredient
              {low_stock.length !== 1 ? "s are" : " is"} running low — tap to manage
            </p>
            <p className="font-body mt-0.5" style={{ fontSize: 12 }}>
              {low_stock.map((i: any) => i.name).join(", ")}
            </p>
          </div>
        </button>
      )}

      {/* ── Filtered period totals ── */}
      <div>
        <SectionLabel>
          {PERIODS.find(p => p.value === period)?.label ?? "Selected Period"}
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Sales"
            value={formatPeso(totals.total_sales)}
            accent="blue"
            icon={<ShoppingCart size={14} />}
          />
          <StatCard
            label="Total Expenses"
            value={formatPeso(totals.total_expenses)}
            accent="orange"
            icon={<Receipt size={14} />}
          />
          <StatCard
            label="Net Profit"
            value={formatPeso(totals.net_profit)}
            sub={
              totals.net_profit > 0
                ? "Profitable period"
                : totals.net_profit < 0
                  ? "Net loss"
                  : "Break even"
            }
            trend={totalsTrend}
            accent={totals.net_profit > 0 ? "green" : totals.net_profit < 0 ? "red" : "blue"}
            icon={
              totals.net_profit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />
            }
          />
        </div>
      </div>

      {/* ── This month ── */}
      <div>
        <SectionLabel>This Month</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Sales" value={formatPeso(this_month.sales)} accent="blue" />
          <StatCard label="Expenses" value={formatPeso(this_month.expenses)} accent="orange" />
          <StatCard
            label="Profit"
            value={formatPeso(this_month.profit)}
            sub={
              this_month.profit > 0
                ? "Profitable"
                : this_month.profit < 0
                  ? "Loss"
                  : "Break even"
            }
            trend={profitTrend}
            accent={this_month.profit > 0 ? "green" : this_month.profit < 0 ? "red" : "blue"}
          />
        </div>
      </div>

      {/* ── Chart + Best selling ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Area chart */}
        <div className="card-surface p-5 lg:col-span-2">
          <p
            className="font-heading font-semibold mb-4"
            style={{ fontSize: 14, color: "#6B4226" }}
          >
            Monthly Overview
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart_data}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5EDE0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9B6644", fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9B6644", fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₱${v.toLocaleString()}`}
              />
              <Tooltip
                formatter={(value: number) => formatPeso(value)}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  border: "1px solid #E8E6E1",
                  background: "#FFFDFB",
                  color: "#6B4226",
                  fontFamily: "Inter",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter", color: "#7C7870" }} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorSales)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#colorExpenses)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div className="card-surface p-5">
          <p
            className="font-heading font-semibold mb-4"
            style={{ fontSize: 14, color: "#6B4226" }}
          >
            Top Products
          </p>

          {best_selling.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-body" style={{ fontSize: 13, color: "#A8A49B" }}>
                No sales data yet for this period.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {best_selling.map((item: any, index: number) => (
                <div key={item.product_id} className="flex items-center gap-3">
                  {/* Rank bubble */}
                  <div
                    className="flex items-center justify-center rounded-full font-heading font-semibold flex-shrink-0"
                    style={{
                      width: 24,
                      height: 24,
                      background: index === 0 ? "#FFF0F7" : "#F5F4F1",
                      color: index === 0 ? "#FF6FAE" : "#A8A49B",
                      fontSize: 11,
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-heading font-medium truncate"
                      style={{ fontSize: 13, color: "#6B4226" }}
                    >
                      {item.product_name}
                    </p>
                    <p className="font-body" style={{ fontSize: 11, color: "#9B6644" }}>
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
