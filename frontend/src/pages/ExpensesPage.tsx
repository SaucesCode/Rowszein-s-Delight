import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExpenses, useDeleteExpense } from "@/hooks/useExpenses";
import type { Expense } from "@/types/expense.types";
import { Plus, Download, X, Receipt, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import SkeletonTable from "@/components/SkeletonTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { exportService } from "@/services/export.service";
import toast from "react-hot-toast";

/* ── Category badge colors ── */
const CATEGORY_BADGE: Record<string, string> = {
  ingredient: "badge-info",
  packaging: "badge-purple",
  utilities: "badge-warning",
  transportation: "badge-orange",
  other: "badge-neutral",
};

export default function ExpensesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = {
    page,
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  };

  const exportFilters = {
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  };

  const { data, isLoading, isError } = useExpenses(filters);
  const deleteExpense = useDeleteExpense();

  const expenses: Expense[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);
  const hasFilters = !!dateFrom || !!dateTo;

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteExpense.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleExport = async (type: "csv" | "pdf") => {
    setExporting(true);
    try {
      if (type === "csv") await exportService.expensesCSV(exportFilters);
      else await exportService.expensesPDF(exportFilters);
      toast.success(`Expenses exported as ${type.toUpperCase()}.`);
    } catch {
      toast.error("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track all business costs"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="btn-ghost"
              style={{ fontSize: 13, padding: "7px 12px" }}
              aria-label="Export expenses as CSV"
            >
              <Download size={14} aria-hidden="true" />
              CSV
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting}
              className="btn-ghost"
              style={{ fontSize: 13, padding: "7px 12px" }}
              aria-label="Export expenses as PDF"
            >
              <Download size={14} aria-hidden="true" />
              PDF
            </button>
            <button
              onClick={() => navigate("/expenses/new")}
              className="btn-primary"
            >
              <Plus size={15} aria-hidden="true" />
              Add Expense
            </button>
          </div>
        }
      />

      {/* Date filter strip */}
      <div
        className="flex flex-wrap items-center gap-3 mb-5 px-4 py-3"
        style={{
          background: "#FFFDFB",
          border: "1px solid #E8E6E1",
          borderRadius: 10,
        }}
      >
        <div className="flex items-center gap-2">
          <label
            className="font-body flex-shrink-0"
            style={{ fontSize: 13, color: "#7C7870" }}
          >
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="field-input"
            style={{ width: "auto" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            className="font-body flex-shrink-0"
            style={{ fontSize: 13, color: "#7C7870" }}
          >
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="field-input"
            style={{ width: "auto" }}
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="btn-ghost"
            style={{ fontSize: 12, padding: "4px 10px", color: "#9B6644" }}
          >
            <X size={12} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {isLoading && <SkeletonTable rows={6} cols={5} />}

      {isError && (
        <div className="card-surface p-6 text-center">
          <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
            Failed to load expenses. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && expenses.length === 0 && (
        <div className="card-surface">
          <EmptyState
            icon={Receipt}
            title={hasFilters ? "No expenses found for selected dates" : "No expenses recorded yet"}
            description={
              hasFilters
                ? "Try adjusting or clearing the date filters."
                : "Record your first expense to start tracking business costs."
            }
            action={
              !hasFilters ? (
                <button
                  onClick={() => navigate("/expenses/new")}
                  className="btn-primary"
                >
                  <Plus size={15} aria-hidden="true" />
                  Add Expense
                </button>
              ) : (
                <button onClick={clearFilters} className="btn-ghost">
                  Clear filters
                </button>
              )
            }
          />
        </div>
      )}

      {!isLoading && !isError && expenses.length > 0 && (
        <>
          <div
            className="overflow-hidden overflow-x-auto"
            style={{
              background: "#FFFDFB",
              border: "1px solid #E8E6E1",
              borderRadius: 10,
            }}
          >
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="table-header-row">
                  {["Date", "Category", "Description", "Amount", "Actions"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {expenses.map((expense, idx) => (
                  <tr
                    key={expense.id}
                    className="table-row-hover transition-colors"
                    style={{
                      borderBottom: "1px solid #F5EDE0",
                      background: idx % 2 !== 0 ? "#FFF8F0" : undefined,
                    }}
                  >
                    {/* Date */}
                    <td
                      className="px-4 py-3.5 font-body"
                      style={{ fontSize: 13, color: "#6B4226", whiteSpace: "nowrap" }}
                    >
                      {new Date(expense.date).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* Category badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`badge ${CATEGORY_BADGE[expense.category] ?? "badge-neutral"}`}
                        style={{ fontSize: 11 }}
                      >
                        {expense.category_display}
                      </span>
                    </td>

                    {/* Description */}
                    <td
                      className="px-4 py-3.5 font-body max-w-xs"
                      style={{ fontSize: 13, color: "#7C7870" }}
                    >
                      <span className="line-clamp-1">
                        {expense.description || (
                          <span style={{ color: "#D1CEC7" }}>—</span>
                        )}
                      </span>
                    </td>

                    {/* Amount */}
                    <td
                      className="px-4 py-3.5 font-body"
                      style={{ fontSize: 13, color: "#3D3A35", fontWeight: 600 }}
                    >
                      ₱{Number(expense.amount).toFixed(2)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/expenses/${expense.id}/edit`)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: "#A8A49B" }}
                          onMouseOver={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "#FFF0F7";
                            (e.currentTarget as HTMLElement).style.color = "#FF6FAE";
                          }}
                          onMouseOut={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "#A8A49B";
                          }}
                          aria-label={`Edit expense from ${expense.date}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(expense)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: "#A8A49B" }}
                          onMouseOver={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                            (e.currentTarget as HTMLElement).style.color = "#EF4444";
                          }}
                          onMouseOut={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "#A8A49B";
                          }}
                          aria-label={`Delete expense from ${expense.date}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

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