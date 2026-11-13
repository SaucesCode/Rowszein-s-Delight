import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ChartMonth } from "@/services/dashboard.service";
import { formatAxisPeso, formatPeso } from "./report-format";

const SERIES = [
  { key: "sales", name: "Sold", color: "var(--color-series-sold)" },
  { key: "expenses", name: "Spent", color: "var(--color-series-spent)" },
] as const;

/** Values lead, labels follow; a short line keys each series; "Kept" closes the readout. */
function MonthTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartMonth;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{label}</p>
      {SERIES.map(series => (
        <p key={series.key} className="chart-tooltip-row">
          <span className="chart-tooltip-key" style={{ background: series.color }} aria-hidden="true" />
          <strong className="num">{formatPeso(row[series.key])}</strong>
          <span>{series.name}</span>
        </p>
      ))}
      <p className="chart-tooltip-row is-total">
        <span className="chart-tooltip-key" aria-hidden="true" />
        <strong className="num">{formatPeso(row.profit)}</strong>
        <span>{row.profit >= 0 ? "Kept" : "Lost"}</span>
      </p>
    </div>
  );
}

/** Money in and out per month: paired columns on one peso axis. */
export default function DashboardChart({ rows }: { rows: ChartMonth[] }) {
  return (
    <div className="analytics-chart" role="img" aria-label="Columns comparing money sold and spent for each month. The table below lists the same figures.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height: 280 }}>
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 13 }} dy={6} />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisPeso}
            tick={{ fill: "var(--color-ink-muted)", fontSize: 13 }}
          />
          <Tooltip content={MonthTooltip} cursor={{ fill: "var(--color-canvas)" }} isAnimationActive={false} />
          {SERIES.map(series => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.name}
              fill={series.color}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
