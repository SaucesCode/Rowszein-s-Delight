import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSales, useDeleteSale } from "@/hooks/useSales";
import type { Sale } from "@/types/sale.types";
import { Pencil, Trash2, Plus } from "lucide-react";

export default function SalesPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useSales(page);
  const deleteSale = useDeleteSale();

  const sales: Sale[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;
    deleteSale.mutate(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Sales</h1>
          <p className="text-sm text-slate-500 mt-1">Track all revenue transactions</p>
        </div>
        <button
          onClick={() => navigate("/sales/new")}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
        >
          <Plus size={16} />
          Record Sale
        </button>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}

      {isError && <p className="text-sm text-red-500">Failed to load sales.</p>}

      {!isLoading && !isError && sales.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No sales recorded yet.</p>
          <button
            onClick={() => navigate("/sales/new")}
            className="mt-2 text-sm text-slate-600 underline"
          >
            Record your first sale
          </button>
        </div>
      )}

      {sales.length > 0 && (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(sale.date).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {sale.sale_items.length} item
                      {sale.sale_items.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {sale.notes || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      ₱{Number(sale.total_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/sales/${sale.id}/edit`)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="text-slate-500 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1 rounded border disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="text-sm px-3 py-1 rounded border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
