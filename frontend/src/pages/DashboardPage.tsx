import { lazy, Suspense, useId, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Calculator, CalendarDays, ChartNoAxesCombined, Package, Plus, Receipt, ShoppingBag } from "lucide-react";
import DateRangeFilter from "@/components/DateRangeFilter";
import StatCard from "@/components/StatCard";
import WorkspaceState from "@/components/WorkspaceState";
import { useDashboard } from "@/hooks/useDashboard";
import { customDateRange, formatBusinessDate, getDateRange, manilaDate, reportRangeError, type DashboardPeriod } from "@/lib/dateRanges";
import type { ChartMonth, DashboardReport } from "@/services/dashboard.service";
import { formatPeso, formatUnits, monthComparison, stockLabel } from "./dashboard/report-format";
import "./dashboard/dashboard.css";

const DashboardChart = lazy(() => import("./dashboard/DashboardChart"));

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "this_week", label: "Week" },
  { value: "this_month", label: "Month" },
  { value: "this_quarter", label: "Quarter" },
  { value: "this_year", label: "Year" },
  { value: "custom", label: "Custom" },
];

function ChartLoading() {
  return <div className="workspace-skeleton dashboard-chart" role="status" aria-label="Loading trend chart" />;
}

function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="dashboard-loading">
      <div className="dashboard-stats">
        <div className="workspace-skeleton" /><div className="workspace-skeleton" /><div className="workspace-skeleton" />
      </div>
      <div className="dashboard-panels">
        <div className="workspace-skeleton" /><div className="workspace-skeleton" />
      </div>
    </div>
  );
}

function TrendPanel({ rows }: { rows: ChartMonth[] }) {
  const [showTable, setShowTable] = useState(false);
  const hasActivity = rows.some(row => row.sales !== 0 || row.expenses !== 0 || row.profit !== 0);
  return (
    <section className="workspace-card dashboard-panel" aria-labelledby="dashboard-trend">
      <div className="dashboard-panel-head">
        <h2 id="dashboard-trend">Monthly trends</h2>
        <p>Net sales by posting date and expenses by expense date.</p>
      </div>
      {hasActivity ? (
        <>
          <ul className="dashboard-legend" aria-label="Chart legend">
            <li><span className="dashboard-swatch" /> Net sales</li>
            <li><span className="dashboard-swatch dashboard-swatch--expenses" /> Expenses</li>
            <li><span className="dashboard-swatch dashboard-swatch--balance" /> Sales less expenses</li>
          </ul>
          <Suspense fallback={<ChartLoading />}><DashboardChart rows={rows} /></Suspense>
        </>
      ) : (
        <WorkspaceState icon={ChartNoAxesCombined} title="No movement to chart" description="Net sales and expenses are both zero for this range. Choose a different date range to see other periods." />
      )}
      <details className="dashboard-figures" onToggle={event => setShowTable(event.currentTarget.open)}>
        <summary>View monthly figures</summary>
        {showTable && (
          <div className="workspace-table-scroll" tabIndex={0} role="region" aria-label="Monthly figures table">
            <table className="workspace-table dashboard-month-table">
              <thead><tr><th scope="col">Month</th><th scope="col" className="workspace-number">Net sales</th><th scope="col" className="workspace-number">Expenses</th><th scope="col" className="workspace-number">Sales less expenses</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.month}>
                    <th scope="row">{row.month}</th>
                    <td className="workspace-number">{formatPeso(row.sales)}</td>
                    <td className="workspace-number">{formatPeso(row.expenses)}</td>
                    <td className="workspace-number">{formatPeso(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}

function StockPanel({ items }: { items: DashboardReport["low_stock"] }) {
  return (
    <section className="workspace-card dashboard-panel dashboard-stock" aria-labelledby="dashboard-stock">
      <div className="dashboard-panel-head">
        <h2 id="dashboard-stock">Stock watch</h2>
        <p>Current inventory · independent of the date range</p>
      </div>
      {items.length ? (
        <>
          <p className="badge badge-warning dashboard-stock-count">
            <AlertCircle size={15} aria-hidden="true" /> {items.length} at or below minimum
          </p>
          <ul className="dashboard-stock-list" tabIndex={items.length > 4 ? 0 : undefined} aria-label="Ingredients at or below minimum">
            {items.map(item => (
              <li key={item.id}>
                <span className="dashboard-stock-icon"><Package size={17} aria-hidden="true" /></span>
                <div>
                  <p>{item.name}</p>
                  <small className="workspace-number">{stockLabel(item.quantity, item.unit)} on hand / {stockLabel(item.minimum_stock, item.unit)} minimum</small>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="badge badge-success dashboard-stock-count">No low-stock alerts</p>
      )}
      <Link to="/ingredients" className="workspace-button workspace-button--secondary dashboard-stock-action">Open inventory</Link>
    </section>
  );
}

function ProductPanel({ products }: { products: DashboardReport["best_selling"] }) {
  const maximum = Math.max(1, ...products.map(product => product.total_quantity));
  return (
    <section className="workspace-card dashboard-panel" aria-labelledby="dashboard-products">
      <div className="dashboard-panel-head">
        <h2 id="dashboard-products">Top products</h2>
        <p>Up to five products by units sold. Recorded sales are grouped by their original date.</p>
      </div>
      {products.length ? (
        <div className="workspace-table-scroll dashboard-product-scroll" role="region" aria-label="Product performance table" tabIndex={0}>
          <table className="workspace-table dashboard-product-table">
            <thead><tr><th scope="col">Product</th><th scope="col" className="workspace-number">Units sold</th><th scope="col" className="workspace-number">Item value</th></tr></thead>
            <tbody>
              {products.map((product, index) => (
                <tr key={product.product_id}>
                  <th scope="row">
                    <div className="dashboard-product-name">
                      <span className="dashboard-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
                      <span>{product.product_name}</span>
                    </div>
                  </th>
                  <td className="workspace-number">
                    <div className="dashboard-product-quantity">
                      <span className="dashboard-product-meter" aria-hidden="true"><span style={{ width: `${product.total_quantity / maximum * 100}%` }} /></span>
                      {formatUnits(product.total_quantity)}
                    </div>
                  </td>
                  <td className="workspace-number">{formatPeso(product.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <WorkspaceState icon={ShoppingBag} title="No product sales for this range" description="Choose another date range or record a sale to start tracking products." action={<Link to="/sales/new" className="btn-secondary">Record sale</Link>} />
      )}
    </section>
  );
}

function DashboardContent({ report, period, monthIndex }: { report: DashboardReport; period: DashboardPeriod; monthIndex: number }) {
  const { totals, chart_data, low_stock, best_selling, filters } = report;
  const sameYear = filters.date_from.slice(0, 4) === filters.date_to.slice(0, 4);
  const rows = sameYear && chart_data.length === 12
    ? chart_data.slice(Number(filters.date_from.slice(5, 7)) - 1, Number(filters.date_to.slice(5, 7)))
    : chart_data;
  const comparison = (key: "sales" | "expenses" | "profit") =>
    period === "this_year" ? monthComparison(chart_data, monthIndex, key) : undefined;
  const balanceComparison = comparison("profit");
  return (
    <>
      <dl className="dashboard-stats" aria-label="Financial totals for selected dates">
        <StatCard label="Net sales" value={formatPeso(totals.net_sales)} icon={ShoppingBag} emphasis
          context={comparison("sales") ?? "Sales, adjustments and cancellations"} />
        <StatCard label="Expenses" value={formatPeso(totals.total_expenses)} icon={Receipt}
          context={comparison("expenses") ?? "Recorded expense amounts"} />
        <StatCard label="Sales less expenses" value={formatPeso(totals.net_profit)} icon={Calculator} negative={totals.net_profit < 0}
          context={<>{balanceComparison && <span>{balanceComparison}<br /></span>}<span>Recorded net sales minus expenses</span></>} />
      </dl>
      <div className="dashboard-panels">
        <TrendPanel rows={rows} />
        <StockPanel items={low_stock} />
      </div>
      <ProductPanel products={best_selling} />
    </>
  );
}

export default function DashboardPage() {
  const radioName = useId();
  const [period, setPeriod] = useState<DashboardPeriod>("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const now = new Date();
  const filters = period === "custom" ? customDateRange(customFrom, customTo) : getDateRange(period, now);
  const rangeError = reportRangeError(filters, now);
  const { data, isLoading, isError, refetch } = useDashboard(filters, !rangeError);
  const displayed = data?.filters ?? { ...getDateRange("this_year", now), ...filters };
  const dateLabel = rangeError ? "Check your date range" : displayed.date_from === displayed.date_to
    ? formatBusinessDate(displayed.date_from)
    : `${formatBusinessDate(displayed.date_from)} – ${formatBusinessDate(displayed.date_to)}`;

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <div>
          <h1 className="workspace-title">Dashboard</h1>
          <p>Review bakery sales, expenses and stock at a glance.</p>
        </div>
        <Link to="/sales/new" className="workspace-button workspace-button--primary"><Plus size={18} aria-hidden="true" /> Record sale</Link>
      </div>
      <div className="dashboard-filter">
        <div className="dashboard-filter-bar">
          <div className="dashboard-filter-date">
            <span className="dashboard-calendar"><CalendarDays size={19} aria-hidden="true" /></span>
            <div>
              <p aria-live="polite" className="workspace-number">{dateLabel}</p>
              <small>Asia/Manila business dates</small>
            </div>
          </div>
          <fieldset className="dashboard-period">
            <legend className="sr-only">Select time period</legend>
            {PERIODS.map(({ value, label }) => (
              <label key={value}>
                <input type="radio" name={radioName} checked={period === value} onChange={() => setPeriod(value)} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </div>
        {period === "custom" && (
          <DateRangeFilter dateFrom={customFrom} dateTo={customTo} onDateFromChange={setCustomFrom} onDateToChange={setCustomTo}
            hasFilters={!!(customFrom || customTo)} onClear={() => { setCustomFrom(""); setCustomTo(""); }} error={rangeError} />
        )}
      </div>
      {!rangeError && isLoading && <DashboardLoading />}
      {!rangeError && isError && (
        <div className="workspace-card">
          <WorkspaceState alert icon={AlertCircle} title="Dashboard unavailable" description="The report could not load. Try again or choose a different date range."
            action={<button type="button" className="btn-secondary" onClick={() => void refetch()}>Try again</button>} />
        </div>
      )}
      {!rangeError && !isError && data && <DashboardContent report={data} period={period} monthIndex={Number(manilaDate(now).slice(5, 7)) - 1} />}
    </div>
  );
}
