import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExpenses, useDeleteExpense } from "@/hooks/useExpenses";
import type { Expense } from "@/types/expense.types";
import { Pencil, Trash2, Plus } from "lucide-react";
import { clsx } from "clsx";

const CATEGORY_STYLES: Record<string, string> = {
  ingredient: "bg-blue-100 text-blue-700",
  packaging: "bg-purple-100 text-purple-700",
  utilities: "bg-yellow-100 text-yellow-700",
  transportation: "bg-orange-100 text-orange-700",
  other: "bg-slate-100 text-slate-600",
};

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useExpenses(page);
  const deleteExpense = useDeleteExpense();

  const expenses: Expense[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    deleteExpense.mutate(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track all business costs</p>
        </div>
        <button
          onClick={() => navigate("/expenses/new")}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}

      {isError && <p className="text-sm text-red-500">Failed to load expenses.</p>}

      {!isLoading && !isError && expenses.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No expenses recorded yet.</p>
          <button
            onClick={() => navigate("/expenses/new")}
            className="mt-2 text-sm text-slate-600 underline"
          >
            Record your first expense
          </button>
        </div>
      )}

      {expenses.length > 0 && (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(expense.date).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          CATEGORY_STYLES[expense.category],
                        )}
                      >
                        {expense.category_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {expense.description || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      ₱{Number(expense.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/expenses/${expense.id}/edit`)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
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
