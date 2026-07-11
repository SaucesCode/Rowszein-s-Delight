import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExpenses, useDeleteExpense } from "@/hooks/useExpenses";
import type { Expense, ExpenseCategory } from "@/types/expense.types";
import { Plus, Receipt, SearchX } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import PeriodToggle from "@/components/PeriodToggle";
import SearchInput from "@/components/SearchInput";
import CategoryFilterBar from "@/components/CategoryFilterBar";
import ExportMenu from "@/components/ExportMenu";
import ExpenseRow from "@/components/ExpenseRow";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import DateRangeFilter from "@/components/DateRangeFilter";
import { exportService } from "@/services/export.service";
import { getDateRange, PERIOD_OPTIONS, type Period } from "@/lib/dateRanges";
import { groupByDay, formatDayLabel } from "@/lib/groupByDay";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────────
   CATEGORY FILTER OPTIONS — static, matches the
   fixed enum on the backend (Expense.Category)
   ───────────────────────────────────────────── */
const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "ingredient", label: "Ingredient Purchase" },
  { value: "packaging", label: "Packaging" },
  { value: "utilities", label: "Utilities" },
  { value: "transportation", label: "Transportation" },
  { value: "other", label: "Other" },
];

function matchesSearch(expense: Expense, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    expense.description?.toLowerCase().includes(q) ||
    expense.category_display.toLowerCase().includes(q)
  );
}

/* ─────────────────────────────────────────────
   SKELETON — matches the grouped-row layout,
   same shape as SalesSkeleton.
   ───────────────────────────────────────────── */
function ExpensesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading expenses…"
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
          <div className="skeleton" style={{ height: 20, width: 88, borderRadius: 999 }} />
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
export default function ExpensesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  // Defaults to "this month" rather than Sales' "today" — expenses are
  // logged far less often than sales, so a same-day default would greet
  // the owner with an empty list most of the time.
  const [period, setPeriod] = useState<Period>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [exporting, setExporting] = useState(false);

  const dateRange =
    period === "custom" ? { date_from: customFrom, date_to: customTo } : getDateRange(period);

  const filters = { page, ...dateRange };
  const { data, isLoading, isError } = useExpenses(filters);
  const deleteExpense = useDeleteExpense();

  const expenses: Expense[] = data?.data?.results ?? [];
  const totalCount: number = data?.data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  const filteredExpenses = useMemo(() => {
    let list = expenses.filter(e => matchesSearch(e, search));
    if (categoryFilter !== "all") {
      list = list.filter(e => e.category === categoryFilter);
    }
    return list;
  }, [expenses, search, categoryFilter]);

  const groups = useMemo(
    () => groupByDay(filteredExpenses, e => Number(e.amount)),
    [filteredExpenses],
  );
  const pageTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [filteredExpenses],
  );

  const categoryCounts = useMemo(() => {
    return expenses.reduce<Record<string, number>>((acc, e) => {
      acc.all = (acc.all ?? 0) + 1;
      acc[e.category] = (acc[e.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [expenses]);

  const hasActiveFilters = period !== "this_month" || !!search || categoryFilter !== "all";

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteExpense.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  const handleExport = async (type: "csv" | "pdf") => {
    setExporting(true);
    try {
      const exportFilters =
        period === "custom" ? dateRange : getDateRange(period as Exclude<Period, "custom">);
      if (type === "csv") await exportService.expensesCSV(exportFilters);
      else await exportService.expensesPDF(exportFilters);
      toast.success(`Expenses exported as ${type.toUpperCase()}.`);
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
        title="Expenses"
        description={
          !isLoading && !isError
            ? `${totalCount} expense${totalCount !== 1 ? "s" : ""} · ₱${pageTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })} on this page`
            : "Track all business costs"
        }
        action={
          <div className="hidden sm:flex items-center gap-2">
            <ExportMenu
              onExportCSV={() => handleExport("csv")}
              onExportPDF={() => handleExport("pdf")}
              exporting={exporting}
            />
            <button onClick={() => navigate("/expenses/new")} className="btn-primary">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              Add Expense
            </button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by description or category…"
          ariaLabel="Search expenses"
        />
        <PeriodToggle
          options={PERIOD_OPTIONS}
          value={period}
          onChange={handlePeriodChange}
          ariaLabel="Filter expenses by period"
        />
      </div>

      <div className="mb-5">
        <CategoryFilterBar
          options={CATEGORY_OPTIONS.map(c => ({ value: c.value, label: c.label }))}
          active={categoryFilter}
          onChange={setCategoryFilter}
          counts={categoryCounts}
          ariaLabel="Filter by category"
        />
      </div>

      {period === "custom" && (
        <div className="mb-5 animate-fade-in">
          <DateRangeFilter
            dateFrom={customFrom}
            dateTo={customTo}
            onDateFromChange={v => {
              setCustomFrom(v);
              setPage(1);
            }}
            onDateToChange={v => {
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

      {isLoading && <ExpensesSkeleton />}

      {isError && (
        <div className="card-surface p-6 text-center">
          <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
            Failed to load expenses. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && filteredExpenses.length === 0 && (
        <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 16 }}>
          <EmptyState
            icon={search || categoryFilter !== "all" ? SearchX : Receipt}
            title={
              search || categoryFilter !== "all"
                ? "No expenses match your filters"
                : hasActiveFilters
                  ? "No expenses for this period"
                  : "No expenses recorded yet"
            }
            description={
              search || categoryFilter !== "all"
                ? "Try a different search, category, or clear filters."
                : hasActiveFilters
                  ? "Try a different date range."
                  : "Record your first expense to start tracking business costs."
            }
            action={
              search || categoryFilter !== "all" ? (
                <button
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                  }}
                  className="btn-secondary"
                >
                  Clear filters
                </button>
              ) : !hasActiveFilters ? (
                <button onClick={() => navigate("/expenses/new")} className="btn-primary">
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  Add Expense
                </button>
              ) : (
                <button
                  onClick={() => handlePeriodChange("this_month")}
                  className="btn-secondary"
                >
                  Back to this month
                </button>
              )
            }
          />
        </div>
      )}

      {!isLoading && !isError && filteredExpenses.length > 0 && (
        <>
          <div
            style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 16 }}
            className="overflow-hidden"
          >
            {groups.map(group => (
              <div key={group.date}>
                <div
                  className="flex items-center justify-between px-5 py-2.5 sticky top-0 z-10"
                  style={{ background: "#FFF8F0", borderBottom: "1px solid #F0E6D8" }}
                >
                  <h2
                    className="font-heading font-semibold"
                    style={{ fontSize: 13, color: "#6B4226" }}
                  >
                    {formatDayLabel(group.date)}
                  </h2>
                  <p className="font-body" style={{ fontSize: 12.5, color: "#9B6644" }}>
                    {group.items.length} expense{group.items.length !== 1 ? "s" : ""} · ₱
                    {group.subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {group.items.map(expense => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onEdit={() => navigate(`/expenses/${expense.id}/edit`)}
                    onDelete={() => setDeleteTarget(expense)}
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
        onClick={() => navigate("/expenses/new")}
        className="sm:hidden fixed z-30 flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          background: "#FF6FAE",
          boxShadow: "0 8px 24px rgba(255, 111, 174, 0.45)",
        }}
        aria-label="Record a new expense"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete expense?"
        description={
          deleteTarget
            ? `This ${deleteTarget.category_display.toLowerCase()} expense of ₱${Number(deleteTarget.amount).toFixed(2)} will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteExpense.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
