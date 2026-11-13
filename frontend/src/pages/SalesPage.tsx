import { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet, FileText, Plus, Search } from "lucide-react";
import { useDeleteSale, useSales, useSalesSummary } from "@/hooks/useSales";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import { groupByDay } from "@/lib/groupByDay";
import {
  customDateRange,
  dateRangeError,
  formatDayLabel,
  getDateRange,
  manilaDate,
  PERIOD_OPTIONS,
  reportRangeError,
  type Period,
} from "@/lib/dateRanges";
import { exportService } from "@/services/export.service";
import type { Sale } from "@/types/sale.types";
import ConfirmDialog from "@/components/ConfirmDialog";
import DropdownMenu from "@/components/DropdownMenu";
import Pagination from "@/components/Pagination";
import { formatPeso } from "@/pages/dashboard/report-format";
import Receipt from "./sales/Receipt";
import "./sales/sales.css";

const PAGE_SIZE = 20;
const CANCEL_REASONS = ["Customer changed their mind", "Recorded by mistake", "Wrong donuts on the ticket"];
const timeFormatter = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

const PERIOD_PHRASE: Record<Period, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  custom: "In this range",
};

function matchesSearch(sale: Sale, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return !!sale.notes?.toLowerCase().includes(q) || sale.sale_items.some(item => item.product_name?.toLowerCase().includes(q));
}

function ReceiptsSkeleton() {
  return (
    <div className="receipts" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="receipt">
          <span className="skeleton block h-3 w-16" />
          <span className="skeleton mt-4 block h-4 w-full" />
          <span className="skeleton mt-2 block h-4 w-4/5" />
          <span className="skeleton mt-6 block h-6 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function SalesPage() {
  const { data: user } = useMe();
  const navigate = useNavigate();
  const ids = useId();
  const canManage = can(user, "sales.update") && can(user, "sales.cancel");
  const canSeeMoney = can(user, "finance.read");

  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const today = manilaDate(now);
  const range = period === "custom" ? customDateRange(customFrom, customTo) : getDateRange(period, now);
  const rangeError = dateRangeError(range);
  const summaryRangeError = reportRangeError(range, now);

  const { data, isLoading, isError, refetch } = useSales({ page, ...range }, !rangeError);
  const summary = useSalesSummary(range, canSeeMoney && !summaryRangeError);
  const cancelSale = useDeleteSale();

  const count: number = data?.data?.count ?? 0;
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const visible = useMemo(
    () => ((data?.data?.results ?? []) as Sale[]).filter(sale => matchesSearch(sale, search)),
    [data, search],
  );
  const days = useMemo(
    () => groupByDay(visible, sale => (sale.status === "cancelled" ? 0 : Number(sale.total_amount))),
    [visible],
  );

  const changePeriod = (next: Period) => {
    setPeriod(next);
    setPage(1);
  };

  const exportAs = async (type: "csv" | "pdf") => {
    if (rangeError) return;
    setExporting(true);
    try {
      if (type === "csv") await exportService.salesCSV(range);
      else await exportService.salesPDF(range);
      toast.success(type === "csv" ? "Spreadsheet downloaded." : "PDF downloaded.");
    } catch {
      toast.error("Couldn't download the file. Check the connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  const closeCancel = () => {
    setCancelTarget(null);
    setReason("");
    setReasonError(false);
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    if (!reason.trim()) {
      setReasonError(true);
      return;
    }
    cancelSale.mutate(
      { id: cancelTarget.id, revision: cancelTarget.revision, reason: reason.trim() },
      { onSuccess: closeCancel },
    );
  };

  const net = summary.data?.totals?.net_sales;
  const lede = rangeError
    ? " "
    : isLoading
      ? " "
      : `${PERIOD_PHRASE[period]}: ${count} ${count === 1 ? "sale" : "sales"} recorded${canSeeMoney && net !== undefined ? `, ${formatPeso(Number(net))} kept after cancellations` : ""}.`;

  return (
    <div className="sales">
      <header className="page-head">
        <div>
          <h1 className="type-page">Sales register</h1>
          <p className="page-lede">{lede}</p>
        </div>
        <div className="sales-head-actions">
          {can(user, "sales.export") && (
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
          )}
          <button type="button" className="btn-primary" onClick={() => navigate("/sales/new")}>
            <Plus size={20} aria-hidden="true" />
            New sale
          </button>
        </div>
      </header>

      <div className="sales-toolbar">
        <div className="segmented" role="group" aria-label="Which days">
          {PERIOD_OPTIONS.map(option => (
            <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => changePeriod(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <span className="sr-only">Find a donut or note on this page</span>
          <Search size={18} aria-hidden="true" />
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a donut or note" />
        </label>
      </div>

      {period === "custom" && (
        <div className="date-range">
          <div>
            <label htmlFor={`${ids}-from`} className="field-label">From</label>
            <input
              id={`${ids}-from`}
              type="date"
              className="field-input"
              value={customFrom}
              max={today}
              onChange={event => { setCustomFrom(event.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label htmlFor={`${ids}-to`} className="field-label">To</label>
            <input
              id={`${ids}-to`}
              type="date"
              className="field-input"
              value={customTo}
              max={today}
              onChange={event => { setCustomTo(event.target.value); setPage(1); }}
            />
          </div>
          {rangeError && <p className="field-error date-range-error" role="alert">{rangeError}</p>}
        </div>
      )}

      {canSeeMoney && !rangeError && summary.data?.totals && (
        <div className="sales-summary">
          <dl aria-label="Money for these days">
            <div>
              <dt>Sold</dt>
              <dd className="num">{formatPeso(Number(summary.data.totals.gross_sales))}</dd>
            </div>
            <div>
              <dt>Cancelled</dt>
              <dd className="num">{formatPeso(Number(summary.data.totals.cancellation_amount))}</dd>
            </div>
            <div>
              <dt>Changes to past sales</dt>
              <dd className="num">{formatPeso(Number(summary.data.totals.sales_adjustments))}</dd>
            </div>
            <div className="is-net">
              <dt>Kept</dt>
              <dd className="num">{formatPeso(Number(summary.data.totals.net_sales))}</dd>
            </div>
          </dl>
          <p className="sales-summary-note">Counted by the day each sale or change was made. Cash refunds aren't tracked here.</p>
        </div>
      )}
      {canSeeMoney && !rangeError && summaryRangeError && (
        <p className="sales-summary-note">Choose both dates to see the money for this range.</p>
      )}

      {!rangeError && isLoading && (
        <>
          <ReceiptsSkeleton />
          <span className="sr-only" role="status">Loading sales</span>
        </>
      )}

      {!rangeError && isError && (
        <div className="sales-empty" role="alert">
          <h2 className="type-heading">Couldn't load the sales</h2>
          <p>Check the internet connection, then try again.</p>
          <button type="button" className="btn-primary" onClick={() => void refetch()}>Try again</button>
        </div>
      )}

      {!rangeError && !isLoading && !isError && visible.length === 0 && (
        <div className="sales-empty">
          {search ? (
            <>
              <h2 className="type-heading">Nothing matches “{search}”</h2>
              <p>This searches the sales shown on this page. Try another donut or clear the search.</p>
              <button type="button" className="btn-secondary" onClick={() => setSearch("")}>Clear search</button>
            </>
          ) : period === "today" ? (
            <>
              <h2 className="type-heading">No sales yet today</h2>
              <p>When the first customer comes in, ring them up here.</p>
              <button type="button" className="btn-primary" onClick={() => navigate("/sales/new")}>
                <Plus size={20} aria-hidden="true" />
                New sale
              </button>
            </>
          ) : (
            <>
              <h2 className="type-heading">No sales on these days</h2>
              <p>Try a different range.</p>
              <button type="button" className="btn-secondary" onClick={() => changePeriod("today")}>Back to today</button>
            </>
          )}
        </div>
      )}

      {!rangeError && !isLoading && !isError && visible.length > 0 && (
        <>
          {days.map(day => {
            const cancelled = day.items.filter(sale => sale.status === "cancelled").length;
            const kept = day.items.length - cancelled;
            return (
              <section key={day.date} className="sales-day" aria-labelledby={`${ids}-${day.date}`}>
                <header className="sales-day-head">
                  <h2 id={`${ids}-${day.date}`}>{formatDayLabel(day.date, today)}</h2>
                  <p className="num">
                    {kept} {kept === 1 ? "sale" : "sales"}, {formatPeso(day.subtotal)}
                    {cancelled > 0 && ` (${cancelled} cancelled)`}
                  </p>
                </header>
                <div className="receipts">
                  {day.items.map(sale => (
                    <Receipt key={sale.id} sale={sale} canManage={canManage} onCancel={setCancelTarget} />
                  ))}
                </div>
              </section>
            );
          })}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title={
          cancelTarget
            ? `Cancel the ${timeFormatter.format(new Date(cancelTarget.created_at))} sale of ${formatPeso(Number(cancelTarget.total_amount))}?`
            : "Cancel this sale?"
        }
        description="It stays in your records marked as cancelled, and its donuts go back into stock. Cash refunds aren't recorded here."
        confirmLabel="Cancel the sale"
        cancelLabel="Keep the sale"
        destructive
        loading={cancelSale.isPending}
        onConfirm={confirmCancel}
        onCancel={closeCancel}
      >
        <fieldset className="cancel-reason">
          <legend className="field-label">Why is it being cancelled?</legend>
          <div className="flex flex-wrap gap-2">
            {CANCEL_REASONS.map(option => (
              <button
                key={option}
                type="button"
                className="chip"
                aria-pressed={reason === option}
                onClick={() => { setReason(option); setReasonError(false); }}
              >
                {option}
              </button>
            ))}
          </div>
          <label htmlFor={`${ids}-reason`} className="sr-only">Reason, in your own words</label>
          <textarea
            id={`${ids}-reason`}
            className="field-input mt-3"
            rows={2}
            maxLength={2000}
            placeholder="Or type your own reason"
            value={reason}
            onChange={event => { setReason(event.target.value); setReasonError(false); }}
            aria-invalid={reasonError}
            aria-describedby={reasonError ? `${ids}-reason-error` : undefined}
          />
          {reasonError && <p id={`${ids}-reason-error`} className="field-error">Pick or type a reason so it's clear later.</p>}
        </fieldset>
      </ConfirmDialog>
    </div>
  );
}
