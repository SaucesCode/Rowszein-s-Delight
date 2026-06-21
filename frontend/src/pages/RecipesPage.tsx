import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecipes, useDeleteRecipe } from "@/hooks/useRecipes";
import type { Recipe } from "@/types/recipe.types";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import SkeletonTable from "@/components/SkeletonTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";

export default function RecipesPage() {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useRecipes(page);
  const deleteRecipe = useDeleteRecipe();

  const recipes: Recipe[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteRecipe.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  return (
    <div>
      <PageHeader
        title="Recipes"
        description="Define ingredients and production cost per product"
        action={
          <button onClick={() => navigate("/recipes/new")} className="btn-primary">
            <Plus size={15} aria-hidden="true" />
            Add Recipe
          </button>
        }
      />

      {isLoading && <SkeletonTable rows={5} cols={6} />}

      {isError && (
        <div className="card-surface p-6 text-center">
          <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
            Failed to load recipes. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && recipes.length === 0 && (
        <div className="card-surface">
          <EmptyState
            icon={BookOpen}
            title="No recipes yet"
            description="Define a recipe for each product to calculate accurate production costs."
            action={
              <button onClick={() => navigate("/recipes/new")} className="btn-primary">
                <Plus size={15} aria-hidden="true" />
                Add Recipe
              </button>
            }
          />
        </div>
      )}

      {!isLoading && !isError && recipes.length > 0 && (
        <>
          <div
            className="overflow-hidden overflow-x-auto"
            style={{
              background: "#FFFDFB",
              border: "1px solid #E8E6E1",
              borderRadius: 10,
            }}
          >
            <table className="w-full text-sm" style={{ minWidth: 580 }}>
              <thead>
                <tr className="table-header-row">
                  {[
                    "Product",
                    "Ingredients",
                    "Yield",
                    "Batch Cost",
                    "Cost / Unit",
                    "Actions",
                  ].map(col => (
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
                {recipes.map((recipe, idx) => (
                  <tr
                    key={recipe.id}
                    className="table-row-hover transition-colors"
                    style={{
                      borderBottom: "1px solid #F5EDE0",
                      background: idx % 2 !== 0 ? "#FFF8F0" : undefined,
                    }}
                  >
                    {/* Product name */}
                    <td className="px-4 py-3.5">
                      <span
                        className="font-heading font-medium"
                        style={{ fontSize: 13, color: "#6B4226" }}
                      >
                        {recipe.product_name}
                      </span>
                    </td>

                    {/* Ingredient count */}
                    <td
                      className="px-4 py-3.5 font-body"
                      style={{ fontSize: 13, color: "#7C7870" }}
                    >
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        {recipe.recipe_ingredients.length}{" "}
                        {recipe.recipe_ingredients.length === 1 ? "ingredient" : "ingredients"}
                      </span>
                    </td>

                    {/* Yield */}
                    <td
                      className="px-4 py-3.5 font-body"
                      style={{ fontSize: 13, color: "#7C7870" }}
                    >
                      {recipe.yield_quantity} {recipe.yield_quantity === 1 ? "unit" : "units"}
                    </td>

                    {/* Batch cost */}
                    <td
                      className="px-4 py-3.5 font-body"
                      style={{ fontSize: 13, color: "#3D3A35" }}
                    >
                      ₱{Number(recipe.production_cost).toFixed(2)}
                    </td>

                    {/* Cost per unit */}
                    <td
                      className="px-4 py-3.5 font-body"
                      style={{ fontSize: 13, color: "#3D3A35", fontWeight: 600 }}
                    >
                      ₱{Number(recipe.cost_per_unit).toFixed(2)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: "#A8A49B" }}
                          onMouseOver={e => {
                            (e.currentTarget as HTMLElement).style.background = "#FFF0F7";
                            (e.currentTarget as HTMLElement).style.color = "#FF6FAE";
                          }}
                          onMouseOut={e => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "#A8A49B";
                          }}
                          aria-label={`Edit ${recipe.product_name} recipe`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(recipe)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: "#A8A49B" }}
                          onMouseOver={e => {
                            (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                            (e.currentTarget as HTMLElement).style.color = "#EF4444";
                          }}
                          onMouseOut={e => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "#A8A49B";
                          }}
                          aria-label={`Delete ${recipe.product_name} recipe`}
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
        title="Delete recipe?"
        description={
          deleteTarget
            ? `The recipe for "${deleteTarget.product_name}" will be permanently deleted. Production cost calculations for this product will no longer be available.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteRecipe.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}