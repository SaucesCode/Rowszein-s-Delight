import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSales, useDeleteSale } from "@/hooks/useSales";
import type { Sale } from "@/types/sale.types";
import { Plus, ShoppingCart, SearchX } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import PeriodToggle from "@/components/PeriodToggle";
import SearchInput from "@/components/SearchInput";
import ExportMenu from "@/components/ExportMenu";
import SaleRow from "@/components/SaleRow";
import DateRangeFilter from "@/components/DateRangeFilter";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { exportService } from "@/services/export.service";
import { getDateRange, PERIOD_OPTIONS, type Period } from "@/lib/dateRanges";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────────
   GROUPING — by business date (sale.date), in
   the order the API already returns (newest first).
   Grouping is page-local: a day split across two
   pages of results will show as two groups. That's
   an acceptable tradeoff at 20-per-page; worth a
   backend "group by day" endpoint if this becomes
   a real pain point at higher sale volumes.
   ───────────────────────────────────────────── */
function groupByDay(sales: Sale[]) {
  const groups: { date: string; sales: Sale[]; subtotal: number }[] = [];

  for (const sale of sales) {
    const existing = groups.find((g) => g.date === sale.date);
    if (existing) {
      existing.sales.push(sale);
      existing.subtotal += Number(sale.total_amount);
    } else {
      groups.push({ date: sale.date, sales: [sale], subtotal: Number(sale.total_amount) });
    }
  }

  return groups;
}

function formatDayLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" });
}

function matchesSearch(sale: Sale, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (sale.notes?.toLowerCase().includes(q)) return true;
  return (sale.sale_items ?? []).some((item) => item.product_name?.toLowerCase().includes(q));
}

/* ─────────────────────────────────────────────
   SKELETON — matches the grouped-row layout,
   not a generic table skeleton.
   ───────────────────────────────────────────── */
function SalesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading sales…"
      style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 16 }}
      className="overflow-hidden"
    >
      <div className="px-5 py-3" style={{ background: "#FFF8F0" }}>
        <div className="skeleton" style={{ height: 12, width: 140, borderRadius: 6 }} />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-5 py-3.5"
          style={{ borderTop: i > 0 ? "1px solid #F5EDE0" : undefined }}
        >
          <div className="skeleton" style={{ height: 12, width: 48, borderRadius: 6 }} />
          <div className="skeleton flex-1" style={{ height: 12, borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 14, width: 64, borderRadius: 6 }} />
        </div>
      ))}
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function SalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [exporting, setExporting] = useState(false);

  const dateRange = period === "custom" ? { date_from: customFrom, date_to: customTo } : getDateRange(period);

  const filters = { page, ...dateRange };
  const { data, isLoading, isError } = useSales(filters);
  const deleteSale = useDeleteSale();

  const sales: Sale[] = data?.data?.results ?? [];
  const totalCount: number = data?.data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  const filteredSales = useMemo(() => sales.filter((s) => matchesSearch(s, search)), [sales, search]);
  const groups = useMemo(() => groupByDay(filteredSales), [filteredSales]);
  const pageTotal = useMemo(() => filteredSales.reduce((sum, s) => sum + Number(s.total_amount), 0), [filteredSales]);

  const hasActiveFilters = period !== "today" || !!search;

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteSale.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  const handleExport = async (type: "csv" | "pdf") => {
    setExporting(true);
    try {
      const exportFilters = period === "custom" ? dateRange : getDateRange(period as Exclude<Period, "custom">);
      if (type === "csv") await exportService.salesCSV(exportFilters);
      else await exportService.salesPDF(exportFilters);
      toast.success(`Sales exported as ${type.toUpperCase()}.`);
    } catch {
      toast.error("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(value as Period);
    setPage(1);
  };

  return (
    <div className="pb-20 sm:pb-0">
      <PageHeader
        title="Sales"
        description={
          !isLoading && !isError
            ? `${totalCount} sale${totalCount !== 1 ? "s" : ""} · ₱${pageTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })} on this page`
            : "Track all revenue transactions"
        }
        action={
          <div className="hidden sm:flex items-center gap-2">
            <ExportMenu onExportCSV={() => handleExport("csv")} onExportPDF={() => handleExport("pdf")} exporting={exporting} />
            <button onClick={() => navigate("/sales/new")} className="btn-primary">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              Record Sale
            </button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
          }}
          placeholder="Search by product or note…"
          ariaLabel="Search sales"
        />
        <PeriodToggle options={PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} ariaLabel="Filter sales by period" />
      </div>

      {period === "custom" && (
        <div className="mb-5 animate-fade-in">
          <DateRangeFilter
            dateFrom={customFrom}
            dateTo={customTo}
            onDateFromChange={(v) => {
              setCustomFrom(v);
              setPage(1);
            }}
            onDateToChange={(v) => {
              setCustomTo(v);
              setPage(1);
            }}
            onClear={() => {
              setCustomFrom("");
              setCustomTo("");
            }}
            hasFilters={!!customFrom || !!customTo}
          />
        </div>
      )}

      {isLoading && <SalesSkeleton />}

      {isError && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm" style={{ color: "#ef4444" }}>
            Failed to load sales. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && filteredSales.length === 0 && (
        <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 16 }}>
          <EmptyState
            icon={search ? SearchX : ShoppingCart}
            title={search ? "No sales match your search" : hasActiveFilters ? "No sales for this period" : "No sales recorded yet"}
            description={
              search
                ? "Try a different product name or clear the search."
                : hasActiveFilters
                  ? "Try a different date range."
                  : "Record your first sale to start tracking revenue."
            }
            action={
              search ? (
                <button onClick={() => setSearch("")} className="btn-secondary">
                  Clear search
                </button>
              ) : !hasActiveFilters ? (
                <button onClick={() => navigate("/sales/new")} className="btn-primary">
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  Record Sale
                </button>
              ) : (
                <button onClick={() => handlePeriodChange("today")} className="btn-secondary">
                  Back to today
                </button>
              )
            }
          />
        </div>
      )}

      {!isLoading && !isError && filteredSales.length > 0 && (
        <>
          <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 16 }} className="overflow-hidden">
            {groups.map((group) => (
              <div key={group.date}>
                <div
                  className="flex items-center justify-between px-5 py-2.5 sticky top-0 z-10"
                  style={{ background: "#FFF8F0", borderBottom: "1px solid #F0E6D8" }}
                >
                  <h2 className="font-heading font-semibold" style={{ fontSize: 13, color: "#6B4226" }}>
                    {formatDayLabel(group.date)}
                  </h2>
                  <p className="font-body" style={{ fontSize: 12.5, color: "#9B6644" }}>
                    {group.sales.length} sale{group.sales.length !== 1 ? "s" : ""} · ₱
                    {group.subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {group.sales.map((sale) => (
                  <SaleRow
                    key={sale.id}
                    sale={sale}
                    onEdit={() => navigate(`/sales/${sale.id}/edit`)}
                    onDelete={() => setDeleteTarget(sale)}
                  />
                ))}
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Mobile floating action button */}
      <button
        onClick={() => navigate("/sales/new")}
        className="sm:hidden fixed z-30 flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          background: "#FF6FAE",
          boxShadow: "0 8px 24px rgba(255, 111, 174, 0.45)",
        }}
        aria-label="Record a new sale"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete sale?"
        description={
          deleteTarget
            ? `This sale of ₱${Number(deleteTarget.total_amount).toFixed(2)} will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteSale.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}