import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSales, useDeleteSale } from "@/hooks/useSales";
import type { Sale } from "@/types/sale.types";
import { Plus, Download, X, ShoppingCart, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import SkeletonTable from "@/components/SkeletonTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { exportService } from "@/services/export.service";
import toast from "react-hot-toast";

export default function SalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
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

  const { data, isLoading, isError } = useSales(filters);
  const deleteSale = useDeleteSale();

  const sales: Sale[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);
  const hasFilters = !!dateFrom || !!dateTo;

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteSale.mutate(deleteTarget.id, {
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
      if (type === "csv") await exportService.salesCSV(exportFilters);
      else await exportService.salesPDF(exportFilters);
      toast.success(`Sales exported as ${type.toUpperCase()}.`);
    } catch {
      toast.error("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Track all revenue transactions"
        action={
          <div className="flex items-center gap-2">
            {/* Export buttons */}
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="btn-secondary"
              style={{ fontSize: 13, padding: "8px 14px" }}
              aria-label="Export sales as CSV"
            >
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              CSV
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting}
              className="btn-secondary"
              style={{ fontSize: 13, padding: "8px 14px" }}
              aria-label="Export sales as PDF"
            >
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              PDF
            </button>

            {/* Primary action */}
            <button onClick={() => navigate("/sales/new")} className="btn-primary">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              Record Sale
            </button>
          </div>
        }
      />

      {/* Date filter strip */}
      <div className="bento-card p-4 flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label
            className="font-body flex-shrink-0 text-sm"
            style={{ color: "#6b7280" }}
          >
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="field-input"
            style={{ width: "auto" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            className="font-body flex-shrink-0 text-sm"
            style={{ color: "#6b7280" }}
          >
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={e => {
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
            style={{ fontSize: 13, padding: "6px 12px", color: "#6b7280" }}
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && <SkeletonTable rows={6} cols={5} />}

      {/* Error */}
      {isError && (
        <div className="bento-card p-8 text-center">
          <p className="font-body text-sm" style={{ color: "#ef4444" }}>
            Failed to load sales. Please try refreshing the page.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && sales.length === 0 && (
        <div className="bento-card">
          <EmptyState
            icon={ShoppingCart}
            title={hasFilters ? "No sales found for selected dates" : "No sales recorded yet"}
            description={
              hasFilters
                ? "Try adjusting or clearing the date filters."
                : "Record your first sale to start tracking revenue."
            }
            action={
              !hasFilters ? (
                <button onClick={() => navigate("/sales/new")} className="btn-primary">
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  Record Sale
                </button>
              ) : (
                <button onClick={clearFilters} className="btn-secondary">
                  Clear filters
                </button>
              )
            }
          />
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && sales.length > 0 && (
        <>
          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 560 }}>
                <thead>
                  <tr className="table-header-row">
                    {["Date", "Items", "Notes", "Total", "Actions"].map(col => (
                      <th
                        key={col}
                        className="px-6 py-4 text-left"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {sales.map((sale, idx) => (
                    <tr
                      key={sale.id}
                      className="transition-colors hover:bg-gray-50"
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        background: idx % 2 !== 0 ? "#f9fafb" : undefined,
                      }}
                    >
                      {/* Date */}
                      <td
                        className="px-6 py-4 font-body"
                        style={{ fontSize: 14, color: "#111827", fontWeight: 600, whiteSpace: "nowrap" }}
                      >
                        {new Date(sale.date).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Items count */}
                      <td className="px-6 py-4">
                        <span
                          className="font-heading font-semibold"
                          style={{ fontSize: 14, color: "#111827" }}
                        >
                          {(sale.items?.length ?? 0)} item{(sale.items?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </td>

                      {/* Notes */}
                      <td
                        className="px-6 py-4 font-body max-w-xs"
                        style={{ fontSize: 14, color: "#6b7280" }}
                      >
                        <span className="line-clamp-1">
                          {sale.notes || <span style={{ color: "#d1d5db" }}>—</span>}
                        </span>
                      </td>

                      {/* Total */}
                      <td
                        className="px-6 py-4 font-body"
                        style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}
                      >
                        ₱{Number(sale.total_amount).toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/sales/${sale.id}/edit`)}
                            className="rounded-lg p-2 transition-colors"
                            style={{ color: "#9ca3af" }}
                            onMouseOver={e => {
                              (e.currentTarget as HTMLElement).style.background = "#f3f4f6";
                              (e.currentTarget as HTMLElement).style.color = "#ec4899";
                            }}
                            onMouseOut={e => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "#9ca3af";
                            }}
                            aria-label={`Edit sale`}
                          >
                            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(sale)}
                            className="rounded-lg p-2 transition-colors"
                            style={{ color: "#9ca3af" }}
                            onMouseOver={e => {
                              (e.currentTarget as HTMLElement).style.background = "#fee2e2";
                              (e.currentTarget as HTMLElement).style.color = "#ef4444";
                            }}
                            onMouseOut={e => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "#9ca3af";
                            }}
                            aria-label={`Delete sale`}
                          >
                            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Delete confirm dialog */}
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
