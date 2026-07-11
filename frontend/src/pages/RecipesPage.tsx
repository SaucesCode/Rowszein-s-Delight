import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecipes, useDeleteRecipe } from "@/hooks/useRecipes";
import { useProducts, useCategories } from "@/hooks/useProducts";
import type { Recipe } from "@/types/recipe.types";
import type { Category, Product } from "@/types/product.types";
import { Plus, BookOpen, SearchX, ArrowUpDown, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SearchInput from "@/components/SearchInput";
import CategoryFilterBar from "@/components/CategoryFilterBar";
import DropdownMenu from "@/components/DropdownMenu";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import RecipeSummaryBar from "@/components/recipes/RecipeSummaryBar";
import MissingRecipeBanner from "@/components/recipes/MissingRecipeBanner";
import RecipeRow from "@/components/recipes/RecipeRow";
import RecipeCard from "@/components/recipes/RecipeCard";

type SortOption = "name" | "batch_cost_desc" | "cost_per_unit_asc" | "most_ingredients";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "batch_cost_desc", label: "Highest Batch Cost" },
  { value: "cost_per_unit_asc", label: "Lowest Cost / Unit" },
  { value: "most_ingredients", label: "Most Ingredients" },
];

function sortRecipes(list: Recipe[], sort: SortOption) {
  const copy = [...list];
  switch (sort) {
    case "batch_cost_desc":
      return copy.sort((a, b) => Number(b.production_cost) - Number(a.production_cost));
    case "cost_per_unit_asc":
      return copy.sort((a, b) => Number(a.cost_per_unit) - Number(b.cost_per_unit));
    case "most_ingredients":
      return copy.sort((a, b) => b.recipe_ingredients.length - a.recipe_ingredients.length);
    case "name":
    default:
      return copy.sort((a, b) => a.product_name.localeCompare(b.product_name));
  }
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/* ─────────────────────────────────────────────
   SKELETON — summary bar shimmer + table/card
   shimmer, same shape as IngredientsSkeleton.
   ───────────────────────────────────────────── */
function RecipesSkeleton() {
  return (
    <div role="status" aria-label="Loading recipes…">
      <div
        className="flex flex-wrap mb-6 overflow-hidden"
        style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 min-w-[150px] px-5 py-4"
            style={{ borderLeft: i > 0 ? "1px solid #F5EDE0" : undefined }}
          >
            <div className="skeleton" style={{ height: 10, width: "60%", borderRadius: 5 }} />
            <div
              className="skeleton mt-2"
              style={{ height: 18, width: "40%", borderRadius: 5 }}
            />
          </div>
        ))}
      </div>

      <div
        className="hidden md:block overflow-hidden"
        style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: "#F5EDE0" }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div
                    className="skeleton"
                    style={{ height: 10, width: "60%", borderRadius: 5 }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F5EDE0" }}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3.5">
                    <div
                      className="skeleton"
                      style={{ height: 12, width: j === 0 ? "80%" : "55%", borderRadius: 6 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4"
            style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 12 }}
          >
            <div className="flex items-center gap-3">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
              <div className="flex-1 space-y-2">
                <div
                  className="skeleton"
                  style={{ height: 12, width: "60%", borderRadius: 5 }}
                />
                <div
                  className="skeleton"
                  style={{ height: 10, width: "40%", borderRadius: 5 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Loading recipes, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function RecipesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<SortOption>("name");
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  const { data, isLoading, isError } = useRecipes(page);
  const { data: productsData } = useProducts(1);
  const { data: categoriesData } = useCategories();
  const deleteRecipe = useDeleteRecipe();

  const recipes: Recipe[] = data?.data?.results ?? [];
  const totalCount: number = data?.data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  // Products cross-referenced for category labels and for spotting products
  // that don't have a recipe yet. Like the Ingredients page's out-of-stock
  // count, this is scoped to the first page of products (20 items) — good
  // enough for a single shop's menu; revisit with a dedicated endpoint if
  // the catalog grows past a page.
  const products: Product[] = productsData?.data?.results ?? [];
  const categories: Category[] = categoriesData?.data ?? [];

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const categoryOptions = categories
    .filter(category => category.is_active)
    .map(category => ({ value: String(category.id), label: category.name }));

  const missingRecipeProducts = useMemo(() => {
    const costedProductIds = new Set(recipes.map(r => r.product));
    return products.filter(p => !costedProductIds.has(p.id));
  }, [products, recipes]);

  const visibleRecipes = useMemo(() => {
    let list = recipes;

    if (categoryFilter !== "all") {
      list = list.filter(
        r => String(productById.get(r.product)?.category.id) === categoryFilter,
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => r.product_name.toLowerCase().includes(q));
    }

    return sortRecipes(list, sort);
  }, [recipes, categoryFilter, search, sort, productById]);

  const categoryCounts = useMemo(() => {
    return recipes.reduce<Record<string, number>>((acc, r) => {
      acc.all = (acc.all ?? 0) + 1;
      const categoryId = productById.get(r.product)?.category.id;
      if (categoryId !== undefined) {
        acc[String(categoryId)] = (acc[String(categoryId)] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [recipes, productById]);

  const avgProductionCost = average(recipes.map(r => Number(r.production_cost)));
  const avgCostPerUnit = average(recipes.map(r => Number(r.cost_per_unit)));
  const hasActiveFilters = !!search || categoryFilter !== "all";

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteRecipe.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  return (
    <div className="pb-20 sm:pb-0">
      <PageHeader
        title="Recipes"
        description="Define ingredients and production cost per product"
        action={
          <button
            onClick={() => navigate("/recipes/new")}
            className="hidden sm:flex btn-primary"
          >
            <Plus size={15} aria-hidden="true" />
            Add Recipe
          </button>
        }
      />

      {/* Missing-recipe callout — the reason this page exists as a checklist, not just a list */}
      {!isLoading && !isError && (
        <MissingRecipeBanner
          productNames={missingRecipeProducts.map(p => p.name)}
          onClick={() => navigate("/products")}
        />
      )}

      {/* Summary */}
      {!isLoading && !isError && (
        <RecipeSummaryBar
          totalRecipes={totalCount}
          missingCount={missingRecipeProducts.length}
          avgProductionCost={avgProductionCost}
          avgCostPerUnit={avgCostPerUnit}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search recipes by product…"
            ariaLabel="Search recipes"
          />
          <DropdownMenu
            width={200}
            trigger={({ open }) => (
              <button
                className="btn-secondary flex-shrink-0"
                style={{ fontSize: 13, padding: "8px 12px" }}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <ArrowUpDown size={14} strokeWidth={2} aria-hidden="true" />
                Sort
              </button>
            )}
          >
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className="flex items-center justify-between gap-2 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
                style={{ fontSize: 13, color: "#6B4226" }}
              >
                {opt.label}
                {sort === opt.value && (
                  <Check size={14} style={{ color: "#FF6FAE" }} aria-hidden="true" />
                )}
              </button>
            ))}
          </DropdownMenu>
        </div>

        {categoryOptions.length > 0 && (
          <CategoryFilterBar
            options={categoryOptions}
            active={categoryFilter}
            onChange={setCategoryFilter}
            counts={categoryCounts}
            ariaLabel="Filter recipes by category"
          />
        )}
      </div>

      {isLoading && <RecipesSkeleton />}

      {isError && (
        <div
          className="p-8 text-center"
          style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
        >
          <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
            Failed to load recipes. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && totalCount === 0 && (
        <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}>
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

      {!isLoading && !isError && totalCount > 0 && visibleRecipes.length === 0 && (
        <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}>
          <EmptyState
            icon={SearchX}
            title="No recipes match your filters"
            description="Try a different search or category filter."
            action={
              hasActiveFilters ? (
                <button
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                  }}
                  className="btn-secondary"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {!isLoading && !isError && visibleRecipes.length > 0 && (
        <>
          {/* Desktop table */}
          <div
            className="hidden md:block overflow-hidden overflow-x-auto"
            style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
          >
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="table-header-row">
                  {[
                    "Product",
                    "Category",
                    "Ingredients",
                    "Yield",
                    "Batch Cost",
                    "Cost / Unit",
                    "",
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
                {visibleRecipes.map(recipe => (
                  <RecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    category={productById.get(recipe.product)?.category.name}
                    onEdit={() => navigate(`/recipes/${recipe.id}/edit`)}
                    onDelete={() => setDeleteTarget(recipe)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {visibleRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                category={productById.get(recipe.product)?.category.name}
                onEdit={() => navigate(`/recipes/${recipe.id}/edit`)}
                onDelete={() => setDeleteTarget(recipe)}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Mobile floating action button */}
      <button
        onClick={() => navigate("/recipes/new")}
        className="sm:hidden fixed z-30 flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          background: "#FF6FAE",
          boxShadow: "0 8px 24px rgba(255, 111, 174, 0.45)",
        }}
        aria-label="Add a new recipe"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} aria-hidden="true" />
      </button>

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
