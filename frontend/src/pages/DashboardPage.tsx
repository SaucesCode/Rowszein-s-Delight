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
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx";

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
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500">Failed to load dashboard.</p>;
  }

  const { totals, this_month, best_selling, chart_data } = data;

  const profitTrend =
    this_month.profit > 0 ? "up" : this_month.profit < 0 ? "down" : "neutral";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Business performance overview</p>
      </div>

      {/* Overall Stats */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          All Time
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
        {/* Monthly Chart */}
        <div className="col-span-2 bg-white rounded-xl border p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">
            Monthly Overview ({new Date().getFullYear()})
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
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
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

        {/* Best Selling */}
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
