import { useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ChevronRight, Download, FileSpreadsheet, FileText, Plus, Search } from "lucide-react";
import { useExpensesInRange } from "@/hooks/useExpenses";
import { groupByDay } from "@/lib/groupByDay";
import { customDateRange, dateRangeError, formatDayLabel, getDateRange, manilaDate, PERIOD_OPTIONS, type Period } from "@/lib/dateRanges";
import { EXPENSE_CATEGORIES, categoryInfo } from "@/lib/expenseCategories";
import { exportService } from "@/services/export.service";
import type { Expense } from "@/types/expense.types";
import DropdownMenu from "@/components/DropdownMenu";
import { formatPeso } from "@/pages/dashboard/report-format";
import "./expenses/expenses.css";

const PERIOD_PHRASE: Record<Period, string> = {
  today: "today",
  this_week: "this week",
  this_month: "this month",
  custom: "in this range",
};

const centavos = (value: number | string) => Math.round(Number(value) * 100);

function matchesSearch(expense: Expense, query: string) {
  const q = query.trim().toLowerCase();
  return !q || !!expense.description?.toLowerCase().includes(q) || categoryInfo(expense.category).label.toLowerCase().includes(q);
}

function LedgerSkeleton() {
  return (
    <div className="ledger" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="ledger-row">
          <span className="ledger-icon skeleton" />
          <span className="grid flex-1 gap-2">
            <span className="skeleton block h-4 w-1/2" />
            <span className="skeleton block h-3 w-1/4" />
          </span>
          <span className="skeleton block h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function ExpensesPage() {
  const navigate = useNavigate();
  const ids = useId();
  // Expenses are logged far less often than sales, so the month is the useful default.
  const [period, setPeriod] = useState<Period>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const today = manilaDate(now);
  const range = period === "custom" ? customDateRange(customFrom, customTo) : getDateRange(period, now);
  const rangeError = dateRangeError(range);
  const { data, isPending, isError, refetch } = useExpensesInRange(range, !rangeError);
  const loading = !rangeError && isPending;

  const all = useMemo(() => data?.expenses ?? [], [data]);
  const totals = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const expense of all) byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + centavos(expense.amount));
    const sum = [...byCategory.values()].reduce((total, value) => total + value, 0);
    return { byCategory, sum };
  }, [all]);

  const visible = useMemo(
    () => all.filter(expense => (category === "all" || expense.category === category) && matchesSearch(expense, search)),
    [all, category, search],
  );
  const days = useMemo(() => groupByDay(visible, expense => Number(expense.amount)), [visible]);
  const spentCategories = EXPENSE_CATEGORIES.filter(info => (totals.byCategory.get(info.value) ?? 0) > 0);

  const exportAs = async (type: "csv" | "pdf") => {
    if (rangeError) return;
    setExporting(true);
    try {
      if (type === "csv") await exportService.expensesCSV(range);
      else await exportService.expensesPDF(range);
      toast.success(type === "csv" ? "Spreadsheet downloaded." : "PDF downloaded.");
    } catch {
      toast.error("Couldn't download the file. Check the connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="expenses">
      <header className="page-head">
        <div>
          <h1 className="type-page">Shop expenses</h1>
          <p className="page-lede">What the shop paid for, and where the money went.</p>
        </div>
        <div className="expenses-head-actions">
          <DropdownMenu
            width={240}
            trigger={({ open }) => (
              <button type="button" className="btn-ghost" aria-expanded={open} disabled={exporting || !!rangeError}>
                <Download size={18} aria-hidden="true" />
                {exporting ? "Preparing…" : "Download"}
              </button>
            )}
          >
            <button type="button" className="menu-item" onClick={() => void exportAs("csv")}>
              <FileSpreadsheet size={16} aria-hidden="true" />
              Spreadsheet (CSV)
            </button>
            <button type="button" className="menu-item" onClick={() => void exportAs("pdf")}>
              <FileText size={16} aria-hidden="true" />
              Printable PDF
            </button>
          </DropdownMenu>
          <button type="button" className="btn-primary" onClick={() => navigate("/expenses/new")}>
            <Plus size={20} aria-hidden="true" />
            Log an expense
          </button>
        </div>
      </header>

      <section className="quick-log" aria-labelledby={`${ids}-quick`}>
        <h2 id={`${ids}-quick`} className="quick-log-title">What did you pay for?</h2>
        <ul>
          {EXPENSE_CATEGORIES.map(info => {
            const Icon = info.icon;
            return (
              <li key={info.value}>
                <Link to={`/expenses/new?category=${info.value}`} className="quick-log-tile">
                  <span className="quick-log-icon" style={{ background: info.color }} aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span>{info.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="expenses-toolbar">
        <div className="segmented" role="group" aria-label="Which days">
          {PERIOD_OPTIONS.map(option => (
            <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => setPeriod(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <span className="sr-only">Find an expense</span>
          <Search size={18} aria-hidden="true" />
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an expense" />
        </label>
      </div>

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

      {!rangeError && !isError && (
        <section className="spend" aria-labelledby={`${ids}-spend`}>
          <h2 id={`${ids}-spend`} className="spend-label">Spent {PERIOD_PHRASE[period]}</h2>
          <p className="spend-total num">
            {loading ? <span className="skeleton inline-block h-[0.9em] w-[6ch] align-middle" aria-hidden="true" /> : formatPeso(totals.sum / 100)}
          </p>
          {!loading && totals.sum > 0 && (
            <>
              <div className="spend-bar" aria-hidden="true">
                {spentCategories.map(info => (
                  <span
                    key={info.value}
                    style={{ flexGrow: totals.byCategory.get(info.value), background: info.color }}
                    data-dim={(category !== "all" && category !== info.value) || undefined}
                  />
                ))}
              </div>
              <div className="spend-legend" role="group" aria-label="Show one kind of expense">
                <button type="button" className="spend-key" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
                  Everything
                </button>
                {spentCategories.map(info => (
                  <button
                    key={info.value}
                    type="button"
                    className="spend-key"
                    aria-pressed={category === info.value}
                    onClick={() => setCategory(category === info.value ? "all" : info.value)}
                  >
                    <span className="spend-swatch" style={{ background: info.color }} aria-hidden="true" />
                    {info.label}{" "}
                    <span className="num spend-key-amount">{formatPeso((totals.byCategory.get(info.value) ?? 0) / 100)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {data && !data.complete && (
            <p className="field-hint">Showing the first 200 expenses. Choose a shorter range to see the rest.</p>
          )}
        </section>
      )}

      {loading && (
        <>
          <LedgerSkeleton />
          <span className="sr-only" role="status">Loading expenses</span>
        </>
      )}

      {!rangeError && isError && (
        <div className="expenses-empty" role="alert">
          <h2 className="type-heading">Couldn't load the expenses</h2>
          <p>Check the internet connection, then try again.</p>
          <button type="button" className="btn-primary" onClick={() => void refetch()}>Try again</button>
        </div>
      )}

      {!rangeError && !loading && !isError && visible.length === 0 && (
        <div className="expenses-empty">
          {search || category !== "all" ? (
            <>
              <h2 className="type-heading">Nothing matches</h2>
              <p>Try another word, or show every kind of expense.</p>
              <button type="button" className="btn-secondary" onClick={() => { setSearch(""); setCategory("all"); }}>
                Show everything
              </button>
            </>
          ) : (
            <>
              <h2 className="type-heading">Nothing spent {PERIOD_PHRASE[period]}</h2>
              <p>When the shop pays for something, log it here so your profit stays honest.</p>
              <button type="button" className="btn-primary" onClick={() => navigate("/expenses/new")}>
                <Plus size={20} aria-hidden="true" />
                Log an expense
              </button>
            </>
          )}
        </div>
      )}

      {!rangeError && !loading && !isError && visible.length > 0 && (
        <div className="ledger">
          {days.map(day => (
            <section key={day.date} className="ledger-day" aria-labelledby={`${ids}-${day.date}`}>
              <header className="ledger-day-head">
                <h2 id={`${ids}-${day.date}`}>{formatDayLabel(day.date, today)}</h2>
                <p className="num">{formatPeso(day.subtotal)}</p>
              </header>
              <ul>
                {day.items.map(expense => {
                  const info = categoryInfo(expense.category);
                  const Icon = info.icon;
                  return (
                    <li key={expense.id}>
                      <Link to={`/expenses/${expense.id}/edit`} className="ledger-row">
                        <span className="ledger-icon" style={{ background: info.color }} aria-hidden="true">
                          <Icon size={18} strokeWidth={1.75} />
                        </span>
                        <span className="ledger-text">
                          <span className="ledger-what">{expense.description || info.label}</span>
                          {expense.description && <span className="ledger-kind">{info.label}</span>}
                        </span>
                        <span className="ledger-amount num">{formatPeso(Number(expense.amount))}</span>
                        <ChevronRight className="ledger-chevron" size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
