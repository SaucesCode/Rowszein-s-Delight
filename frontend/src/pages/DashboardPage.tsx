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
  Zap,
} from "lucide-react";
import StatCard from "@/components/StatCard";

type Period = "this_week" | "this_month" | "this_quarter" | "this_year" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "this_week", label: "Week" },
  { value: "this_month", label: "Month" },
  { value: "this_quarter", label: "Quarter" },
  { value: "this_year", label: "Year" },
  { value: "custom", label: "Custom" },
];

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

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard…" className="space-y-6">
      <div className="grid-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="premium-card">
            <div className="skeleton h-12 w-24 mb-4" />
            <div className="skeleton h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="premium-card h-80">
          <div className="skeleton h-full" />
        </div>
        <div className="premium-card h-80">
          <div className="skeleton h-full" />
        </div>
      </div>
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

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
      <div className="premium-card p-8 text-center">
        <p className="font-body text-sm" style={{ color: "#ef4444" }}>
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
    <div className="space-y-8 animate-fade-in">
      {/* Header + Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl" style={{ color: "#0f172a" }}>
            Performance Overview
          </h2>
          <p className="font-body text-sm mt-1" style={{ color: "#64748b" }}>
            Track your business metrics and trends
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg font-body text-sm font-medium transition-all ${
                period === p.value
                  ? "bg-ec4899 text-white shadow-sm"
                  : "bg-f5f6f8 text-0f172a border border-e2e8f0 hover:border-cbd5e1"
              }`}
              style={
                period === p.value
                  ? { background: "#ec4899", color: "#ffffff" }
                  : { background: "#f5f6f8", color: "#0f172a", borderColor: "#e2e8f0" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="premium-card p-4 flex flex-wrap items-center gap-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <label className="font-body text-sm" style={{ color: "#64748b" }}>
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
            <label className="font-body text-sm" style={{ color: "#64748b" }}>
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
        </div>
      )}

      {/* Low stock alert */}
      {low_stock?.length > 0 && (
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

      {/* Key Metrics */}
      <div className="grid-3">
        <StatCard
          label="Total Sales"
          value={formatPeso(totals.total_sales)}
          accent="blue"
          icon={<ShoppingCart size={20} strokeWidth={2} />}
        />
        <StatCard
          label="Total Expenses"
          value={formatPeso(totals.total_expenses)}
          accent="orange"
          icon={<Receipt size={20} strokeWidth={2} />}
        />
        <StatCard
          label="Net Profit"
          value={formatPeso(totals.net_profit)}
          sub={
            totals.net_profit > 0
              ? "Profitable"
              : totals.net_profit < 0
                ? "Loss"
                : "Break even"
          }
          trend={totalsTrend}
          accent={totals.net_profit > 0 ? "green" : totals.net_profit < 0 ? "red" : "blue"}
          icon={
            totals.net_profit >= 0 ? (
              <TrendingUp size={20} strokeWidth={2} />
            ) : (
              <TrendingDown size={20} strokeWidth={2} />
            )
          }
        />
      </div>

      {/* This Month Metrics */}
      <div>
        <h3 className="font-heading font-bold text-lg mb-4" style={{ color: "#0f172a" }}>
          This Month
        </h3>
        <div className="grid-3">
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

      {/* Charts */}
      <div className="grid-2">
        {/* Area chart */}
        <div className="premium-card">
          <h3 className="font-heading font-bold text-lg mb-6" style={{ color: "#0f172a" }}>
            Monthly Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chart_data}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#64748b", fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b", fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => formatPeso(value)}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontFamily: "Inter",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter", color: "#64748b" }} />
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
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#colorExpenses)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div className="premium-card">
          <h3 className="font-heading font-bold text-lg mb-6" style={{ color: "#0f172a" }}>
            Top Products
          </h3>

          {best_selling.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap size={32} className="text-gray-300 mb-3" />
              <p className="font-body text-sm" style={{ color: "#cbd5e1" }}>
                No sales data yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {best_selling.map((item: any, index: number) => (
                <div key={item.product_id} className="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-0">
                  <div
                    className="flex items-center justify-center rounded-lg font-heading font-bold flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      background: index === 0 ? "#fce7f3" : "#f5f6f8",
                      color: index === 0 ? "#ec4899" : "#64748b",
                      fontSize: 13,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-heading font-semibold text-sm truncate"
                      style={{ color: "#0f172a" }}
                    >
                      {item.product_name}
                    </p>
                    <p className="font-body text-xs mt-1" style={{ color: "#64748b" }}>
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
