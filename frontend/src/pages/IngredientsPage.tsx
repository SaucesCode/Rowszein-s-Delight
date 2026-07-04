import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIngredients, useDeleteIngredient } from "@/hooks/useIngredients";
import type { Ingredient } from "@/types/ingredient.types";
import { Plus, Pencil, Trash2, AlertTriangle, Package } from "lucide-react";
import { clsx } from "clsx";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import SkeletonTable from "@/components/SkeletonTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";

export default function IngredientsPage() {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useIngredients(page);
  const deleteIngredient = useDeleteIngredient();

  const ingredients: Ingredient[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);
  const lowStockCount = ingredients.filter(i => i.is_low_stock).length;

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteIngredient.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  return (
    <div>
      <PageHeader
        title="Ingredients"
        description="Manage your inventory and track stock levels"
        action={
          <button onClick={() => navigate("/ingredients/new")} className="btn-primary">
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            Add Ingredient
          </button>
        }
      />

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="alert-low-stock mb-6 animate-fade-in">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
          <div>
            <p className="font-heading font-semibold text-sm" style={{ color: "#92400e" }}>
              {lowStockCount} ingredient{lowStockCount !== 1 ? "s are" : " is"} running low
            </p>
            <p className="font-body text-xs mt-1" style={{ color: "#92400e" }}>
              {ingredients
                .filter(i => i.is_low_stock)
                .map(i => i.name)
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && <SkeletonTable rows={6} cols={7} />}

      {/* Error */}
      {isError && (
        <div className="card-surface p-8 text-center">
          <p className="font-body text-sm" style={{ color: "#EF4444" }}>
            Failed to load ingredients. Please try refreshing the page.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && ingredients.length === 0 && (
        <div className="card-surface">
          <EmptyState
            icon={Package}
            title="No ingredients yet"
            description="Add your first ingredient to start tracking inventory and production costs."
            action={
              <button onClick={() => navigate("/ingredients/new")} className="btn-primary">
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                Add Ingredient
              </button>
            }
          />
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && ingredients.length > 0 && (
        <>
          <div
            className="table-container overflow-hidden overflow-x-auto"
            style={{
              background: "#FFFDFB",
              border: "1px solid #E8E6E1",
            }}
          >
            <table className="w-full text-sm" style={{ minWidth: 680 }}>
              <thead>
                <tr className="table-header-row">
                  {[
                    "Name",
                    "Quantity",
                    "Unit",
                    "Min Stock",
                    "Cost / Unit",
                    "Supplier",
                    "Actions",
                  ].map(col => (
                    <th
                      key={col}
                      className="px-5 py-4 text-left"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {ingredients.map((ingredient, idx) => (
                  <tr
                    key={ingredient.id}
                    className={clsx(
                      "transition-colors hover:bg-brand-pink-light",
                      ingredient.is_low_stock
                        ? "bg-warning-bg"
                        : idx % 2 === 0
                          ? ""
                          : "bg-brand-cream",
                    )}
                    style={{
                      borderBottom: "1px solid #F5EDE0",
                      background: ingredient.is_low_stock ? "#FFFBEB" : undefined,
                    }}
                  >
                    {/* Name + badge */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-heading font-medium"
                          style={{ fontSize: 14, color: "#6B4226", fontWeight: 600 }}
                        >
                          {ingredient.name}
                        </span>
                        {ingredient.is_low_stock && (
                          <span className="badge badge-warning">
                            <AlertTriangle size={10} aria-hidden="true" />
                            Low
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quantity — red if low */}
                    <td
                      className="px-5 py-4 font-body"
                      style={{
                        fontSize: 14,
                        color: ingredient.is_low_stock ? "#B91C1C" : "#3D3A35",
                        fontWeight: ingredient.is_low_stock ? 600 : 500,
                      }}
                    >
                      {Number(ingredient.quantity).toLocaleString("en-PH")}
                    </td>

                    <td
                      className="px-5 py-4 font-body"
                      style={{ fontSize: 14, color: "#7C7870" }}
                    >
                      {ingredient.unit}
                    </td>

                    <td
                      className="px-5 py-4 font-body"
                      style={{ fontSize: 14, color: "#7C7870" }}
                    >
                      {ingredient.minimum_stock > 0 ? (
                        Number(ingredient.minimum_stock).toLocaleString("en-PH")
                      ) : (
                        <span style={{ color: "#D1CEC7" }}>—</span>
                      )}
                    </td>

                    <td
                      className="px-5 py-4 font-body"
                      style={{ fontSize: 14, color: "#3D3A35", fontWeight: 500 }}
                    >
                      ₱{Number(ingredient.cost_per_unit).toFixed(2)}
                    </td>

                    <td
                      className="px-5 py-4 font-body"
                      style={{ fontSize: 14, color: "#7C7870" }}
                    >
                      {ingredient.supplier || <span style={{ color: "#D1CEC7" }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="table-cell-action">
                        <button
                          onClick={() => navigate(`/ingredients/${ingredient.id}/edit`)}
                          className="rounded-lg p-2 transition-colors"
                          style={{ color: "#A8A49B" }}
                          onMouseOver={e => {
                            (e.currentTarget as HTMLElement).style.background = "#FFF0F7";
                            (e.currentTarget as HTMLElement).style.color = "#FF6FAE";
                          }}
                          onMouseOut={e => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "#A8A49B";
                          }}
                          aria-label={`Edit ${ingredient.name}`}
                        >
                          <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(ingredient)}
                          className="rounded-lg p-2 transition-colors"
                          style={{ color: "#A8A49B" }}
                          onMouseOver={e => {
                            (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                            (e.currentTarget as HTMLElement).style.color = "#EF4444";
                          }}
                          onMouseOut={e => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "#A8A49B";
                          }}
                          aria-label={`Delete ${ingredient.name}`}
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

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete ingredient?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed from your inventory. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteIngredient.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
