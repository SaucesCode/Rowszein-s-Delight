import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartMonth } from "@/services/dashboard.service";
import { formatAxisPeso, formatPeso } from "./report-format";

export default function DashboardChart({ rows }: { rows: ChartMonth[] }) {
  const singleMonth = rows.length === 1;
  return (
    <div className="dashboard-chart" aria-label="Monthly financial trends in Philippine pesos">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 240, height: 208 }}>
        <ComposedChart accessibilityLayer data={rows} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--ws-rule)" strokeDasharray="3 4" />
          <XAxis dataKey="month" minTickGap={19} tickLine={false} axisLine={false} tick={{ fill: "var(--ws-muted)", fontSize: 11 }} />
          <YAxis width={56} tickLine={false} axisLine={false} tickFormatter={formatAxisPeso} tick={{ fill: "var(--ws-muted)", fontSize: 11 }} />
          <ReferenceLine y={0} stroke="var(--ws-control-border)" />
          <Tooltip
            isAnimationActive={false}
            formatter={value => typeof value === "number" ? formatPeso(value) : String(value ?? "")}
            contentStyle={{ background: "var(--ws-paper)", borderColor: "var(--ws-rule)", borderRadius: 8, fontSize: 12, color: "var(--ws-ink)" }}
          />
          <Area name="Net sales" dataKey="sales" type="linear" stroke="var(--ws-primary)" strokeWidth={2.5}
            fill="var(--ws-blush)" fillOpacity={0.55} isAnimationActive={false} dot={singleMonth} />
          <Line name="Expenses" dataKey="expenses" type="linear" stroke="var(--ws-caramel)" strokeWidth={2}
            strokeDasharray="6 4" isAnimationActive={false} dot={singleMonth} />
          <Line name="Sales less expenses" dataKey="profit" type="linear" stroke="var(--ws-rose)" strokeWidth={2}
            strokeDasharray="2 4" isAnimationActive={false} dot={singleMonth} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
