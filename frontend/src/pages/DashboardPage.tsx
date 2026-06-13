import { useState } from "react";
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
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { useNavigate } from "react-router-dom";

type Period = "this_week" | "this_month" | "this_quarter" | "this_year" | "custom";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}

function StatCard({ label, value, sub, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-800">{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === "up" && <TrendingUp size={13} className="text-green-500" />}
          {trend === "down" && <TrendingDown size={13} className="text-red-500" />}
          {trend === "neutral" && <Minus size={13} className="text-slate-400" />}
          <p
            className={clsx(
              "text-xs",
              trend === "up" && "text-green-600",
              trend === "down" && "text-red-500",
              trend === "neutral" && "text-slate-400",
            )}
          >
            {sub}
          </p>
        </div>
      )}
    </div>
  );
}

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

const PERIODS: { value: Period; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filters =
    period === "custom" ? { date_from: customFrom, date_to: customTo } : getDateRange(period);

  const { data, isLoading, isError } = useDashboard(filters);

  if (isLoading) return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  if (isError) return <p className="text-sm text-red-500">Failed to load dashboard.</p>;

  const { totals, this_month, best_selling, chart_data, low_stock } = data;

  const profitTrend =
    this_month.profit > 0 ? "up" : this_month.profit < 0 ? "down" : "neutral";

  return (
    <div className="space-y-6">
      {/* Header + Period Picker */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Business performance overview</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-slate-800 text-white"
                  : "bg-white border text-slate-600 hover:bg-slate-50",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">To</label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <p className="text-xs text-slate-400 ml-2">
            Showing {filters.date_from} → {filters.date_to}
          </p>
        </div>
      )}

      {/* Low stock alert */}
      {low_stock?.length > 0 && (
        <div
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate("/ingredients")}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">
              {low_stock.length} ingredient{low_stock.length !== 1 ? "s are" : " is"} running
              low
            </p>
            <p className="text-xs mt-0.5">{low_stock.map((i: any) => i.name).join(", ")}</p>
          </div>
        </div>
      )}

      {/* Filtered Totals */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          {PERIODS.find(p => p.value === period)?.label ?? "Selected Period"}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Sales" value={formatPeso(totals.total_sales)} />
          <StatCard label="Total Expenses" value={formatPeso(totals.total_expenses)} />
          <StatCard
            label="Net Profit"
            value={formatPeso(totals.net_profit)}
            trend={totals.net_profit > 0 ? "up" : totals.net_profit < 0 ? "down" : "neutral"}
          />
        </div>
      </div>

      {/* This Month Stats */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          This Month
        </p>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Sales" value={formatPeso(this_month.sales)} />
          <StatCard label="Expenses" value={formatPeso(this_month.expenses)} />
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
          />
        </div>
      </div>

      {/* Chart + Best Selling */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">Monthly Overview</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₱${v.toLocaleString()}`}
              />
              <Tooltip
                formatter={(value: number) => formatPeso(value)}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
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

        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">Top Products</p>
          {best_selling.length === 0 ? (
            <p className="text-sm text-slate-400">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {best_selling.map((item: any, index: number) => (
                <div key={item.product_id} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-400 w-4">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-slate-400">
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
