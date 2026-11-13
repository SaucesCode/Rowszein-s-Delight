import { lazy, Suspense, useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useDashboard, useProductMargins } from "@/hooks/useDashboard";
import { customDateRange, formatBusinessDate, getDateRange, manilaDate, reportRangeError, type DashboardPeriod } from "@/lib/dateRanges";
import type { ChartMonth, DashboardReport } from "@/services/dashboard.service";
import { formatPeso, formatUnits } from "./dashboard/report-format";
import "./dashboard/dashboard.css";

const DashboardChart = lazy(() => import("./dashboard/DashboardChart"));

const PERIODS: { value: DashboardPeriod; label: string; phrase: string }[] = [
  { value: "this_week", label: "Week", phrase: "This week" },
  { value: "this_month", label: "Month", phrase: "This month" },
  { value: "this_quarter", label: "Quarter", phrase: "This quarter" },
  { value: "this_year", label: "Year", phrase: "This year" },
  { value: "custom", label: "Custom", phrase: "In these dates" },
];

const THIN_MARGIN = 30;

/** The API returns every month of the year; keep only the months inside the chosen dates. */
function monthsInRange(report: DashboardReport): ChartMonth[] {
  const { chart_data, filters } = report;
  const sameYear = filters.date_from.slice(0, 4) === filters.date_to.slice(0, 4);
  if (!sameYear || chart_data.length !== 12) return chart_data;
  return chart_data.slice(Number(filters.date_from.slice(5, 7)) - 1, Number(filters.date_to.slice(5, 7)));
}

function BottomLine({ report, phrase }: { report: DashboardReport; phrase: string }) {
  const sold = Number(report.totals.net_sales);
  const spent = Number(report.totals.total_expenses);
  const kept = Number(report.totals.net_profit);
  return (
    <section className="analytics-hero" aria-labelledby="bottom-line">
      <h2 id="bottom-line" className="analytics-kicker">{phrase}, after expenses</h2>
      <p className={`analytics-kept num ${kept < 0 ? "is-loss" : ""}`}>{formatPeso(Math.abs(kept))}</p>
      <p className="analytics-sentence">
        {kept >= 0 ? "kept" : "lost"}, from <strong className="num">{formatPeso(sold)}</strong> sold and{" "}
        <strong className="num">{formatPeso(spent)}</strong> spent.
      </p>
      <p className="analytics-note">Sold counts sales after cancellations and changes, on the day they were made.</p>
    </section>
  );
}

function MonthByMonth({ rows }: { rows: ChartMonth[] }) {
  const quiet = rows.every(row => row.sales === 0 && row.expenses === 0);
  return (
    <section className="analytics-panel" aria-labelledby="by-month">
      <div className="analytics-panel-head">
        <h2 id="by-month" className="analytics-title">Month by month</h2>
        <ul className="analytics-legend" aria-label="Chart key">
          <li><span className="analytics-key is-sold" aria-hidden="true" />Sold</li>
          <li><span className="analytics-key is-spent" aria-hidden="true" />Spent</li>
        </ul>
      </div>
      {rows.length < 2 ? (
        <p className="analytics-quiet">Choose Quarter or Year to compare months side by side.</p>
      ) : quiet ? (
        <p className="analytics-quiet">Nothing was sold or spent in these months yet.</p>
      ) : (
        <Suspense fallback={<div className="analytics-chart skeleton" aria-hidden="true" />}>
          <DashboardChart rows={rows} />
        </Suspense>
      )}
      <details className="analytics-table">
        <summary>Show the numbers</summary>
        <div className="analytics-table-scroll" tabIndex={0} role="region" aria-label="Money by month">
          <table>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Sold</th>
                <th scope="col">Spent</th>
                <th scope="col">Kept</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.month}>
                  <th scope="row">{row.month}</th>
                  <td className="num">{formatPeso(row.sales)}</td>
                  <td className="num">{formatPeso(row.expenses)}</td>
                  <td className={`num ${row.profit < 0 ? "is-loss" : ""}`}>{formatPeso(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function BestSellers({ products }: { products: DashboardReport["best_selling"] }) {
  const most = Math.max(1, ...products.map(product => product.total_quantity));
  return (
    <section className="analytics-panel" aria-labelledby="best-sellers">
      <h2 id="best-sellers" className="analytics-title">Best sellers</h2>
      {products.length === 0 ? (
        <p className="analytics-quiet">No donuts sold in these dates yet.</p>
      ) : (
        <ol className="ranking">
          {products.map(product => (
            <li key={product.product_id}>
              <span className="ranking-name">{product.product_name}</span>
              <span className="ranking-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${product.total_quantity / most})` }} />
              </span>
              <span className="ranking-value num">
                {formatUnits(product.total_quantity)} sold
                <small>{formatPeso(product.total_revenue)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MarginsSummary() {
  const margins = useProductMargins();
  const costed = (margins.data ?? []).filter(row => row.has_recipe);
  const average = costed.length ? Math.round(costed.reduce((sum, row) => sum + row.margin_percent, 0) / costed.length) : null;
  const thin = costed.filter(row => row.margin_percent < THIN_MARGIN);

  return (
    <section className="analytics-panel analytics-margins" aria-labelledby="margins">
      <h2 id="margins" className="analytics-title">What each donut earns</h2>
      {margins.isPending ? (
        <span className="skeleton block h-16 w-full" aria-hidden="true" />
      ) : margins.isError ? (
        <p className="analytics-quiet">Couldn't load the donut costs.</p>
      ) : average === null ? (
        <p className="analytics-quiet">Add recipes to see what each donut costs to make.</p>
      ) : (
        <>
          <p className="analytics-margin-big num">{average}%</p>
          <p className="analytics-quiet">of each donut's price is kept on average, after ingredients.</p>
          {thin.length > 0 && (
            <p className="analytics-thin">
              {thin.length === 1 ? `${thin[0].product_name} keeps` : `${thin.length} donuts keep`} less than {THIN_MARGIN}%.
            </p>
          )}
        </>
      )}
      <Link to="/recipes" className="home-link">
        See every donut's costs
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}

export default function DashboardPage() {
  const ids = useId();
  const [period, setPeriod] = useState<DashboardPeriod>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const now = new Date();
  const today = manilaDate(now);
  const filters = period === "custom" ? customDateRange(customFrom, customTo) : getDateRange(period, now);
  const rangeError = reportRangeError(filters, now);
  const { data, isPending, isError, refetch } = useDashboard(filters, !rangeError);
  const phrase = PERIODS.find(option => option.value === period)?.phrase ?? "";
  const shown = data?.filters;
  const dates = shown
    ? shown.date_from === shown.date_to
      ? formatBusinessDate(shown.date_from)
      : `${formatBusinessDate(shown.date_from)} to ${formatBusinessDate(shown.date_to)}`
    : " ";

  return (
    <div className="analytics">
      <header className="page-head">
        <div>
          <h1 className="type-page">Profit & analytics</h1>
          <p className="page-lede">{rangeError ? "Check the dates below." : dates}</p>
        </div>
        <div className="segmented" role="group" aria-label="Which period">
          {PERIODS.map(option => (
            <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => setPeriod(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {period === "custom" && (
        <div className="date-range">
          <div>
            <label htmlFor={`${ids}-from`} className="field-label">From</label>
            <input id={`${ids}-from`} type="date" className="field-input" value={customFrom} max={today} onChange={event => setCustomFrom(event.target.value)} />
          </div>
          <div>
            <label htmlFor={`${ids}-to`} className="field-label">To</label>
            <input id={`${ids}-to`} type="date" className="field-input" value={customTo} max={today} onChange={event => setCustomTo(event.target.value)} />
          </div>
          {rangeError && <p className="field-error date-range-error" role="alert">{rangeError}</p>}
        </div>
      )}

      {!rangeError && isError && (
        <div className="analytics-panel" role="alert">
          <h2 className="analytics-title">Couldn't load the numbers</h2>
          <p className="analytics-quiet">Check the internet connection, then try again.</p>
          <button type="button" className="btn-primary" onClick={() => void refetch()}>Try again</button>
        </div>
      )}

      {!rangeError && !isError && isPending && (
        <div className="analytics-grid" aria-busy="true">
          <span className="skeleton block h-64 w-full analytics-span" aria-hidden="true" />
          <span className="skeleton block h-80 w-full analytics-span" aria-hidden="true" />
          <span className="sr-only" role="status">Loading the numbers</span>
        </div>
      )}

      {!rangeError && !isError && data && (
        <div className="analytics-grid">
          <BottomLine report={data} phrase={phrase} />
          <MonthByMonth rows={monthsInRange(data)} />
          <BestSellers products={data.best_selling} />
          <MarginsSummary />
        </div>
      )}
    </div>
  );
}
