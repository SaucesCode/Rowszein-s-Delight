import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useIngredients,
  useDeleteIngredient,
  useUpdateStock,
  useLowStockIngredients,
} from "@/hooks/useIngredients";
import type { Ingredient } from "@/types/ingredient.types";
import { Plus, Package, SearchX, ArrowUpDown, Check, Download } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SearchInput from "@/components/SearchInput";
import CategoryFilterBar from "@/components/CategoryFilterBar";
import PeriodToggle from "@/components/PeriodToggle";
import DropdownMenu from "@/components/DropdownMenu";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import InventorySummaryBar from "@/components/ingredients/InventorySummaryBar";
import IngredientRow from "@/components/ingredients/IngredientRow";
import IngredientCard from "@/components/ingredients/IngredientCard";
import UpdateStockModal from "@/components/ingredients/UpdateStockModal";
import { resolveStockStatus } from "@/components/ingredients/StockStatusBadge";
import { exportIngredientsCSV } from "@/lib/exportIngredientsCSV";

type SortOption = "name" | "stock_asc" | "stock_desc" | "value_desc";
type StatusFilter = "all" | "healthy" | "low_stock" | "out_of_stock";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "stock_asc", label: "Stock: Low to High" },
  { value: "stock_desc", label: "Stock: High to Low" },
  { value: "value_desc", label: "Value: High to Low" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];

function sortIngredients(list: Ingredient[], sort: SortOption) {
  const copy = [...list];
  switch (sort) {
    case "stock_asc":
      return copy.sort((a, b) => Number(a.quantity) - Number(b.quantity));
    case "stock_desc":
      return copy.sort((a, b) => Number(b.quantity) - Number(a.quantity));
    case "value_desc":
      return copy.sort(
        (a, b) =>
          Number(b.quantity) * Number(b.cost_per_unit) -
          Number(a.quantity) * Number(a.cost_per_unit),
      );
    case "name":
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/* ─────────────────────────────────────────────
   SKELETON — matches the dashboard's shimmer
   style, table on desktop / cards on mobile.
   ───────────────────────────────────────────── */
function IngredientsSkeleton() {
  return (
    <div role="status" aria-label="Loading ingredients…">
      {/* Summary bar skeleton */}
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

      {/* Desktop table skeleton */}
      <div
        className="hidden md:block overflow-hidden"
        style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: "#F5EDE0" }}>
              {Array.from({ length: 8 }).map((_, i) => (
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
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F5EDE0" }}>
                {Array.from({ length: 8 }).map((_, j) => (
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

      {/* Mobile card skeleton */}
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

      <span className="sr-only">Loading ingredients, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function IngredientsPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("name");
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [stockTarget, setStockTarget] = useState<Ingredient | null>(null);

  const { data, isLoading, isError } = useIngredients(page);
  const { data: lowStockData } = useLowStockIngredients();
  const deleteIngredient = useDeleteIngredient();
  const updateStock = useUpdateStock(stockTarget?.id ?? 0);

  const pageIngredients: Ingredient[] = data?.data?.results ?? [];
  const totalCount: number = data?.data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  // Low stock count comes from the dedicated /low-stock/ endpoint so it
  // reflects the whole inventory, not just the current page.
  const lowStockCount = lowStockData?.length ?? 0;

  // Out-of-stock count and inventory value are computed from the current
  // page only — there's no "all ingredients" endpoint (pagination is fixed
  // at 20/page server-side), so these two figures are page-scoped like the
  // rest of this table. Good enough for a single-page shop's inventory;
  // worth revisiting if the catalog grows past a page or two.
  const outOfStockCount = pageIngredients.filter(i => Number(i.quantity) <= 0).length;
  const totalValue = pageIngredients.reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.cost_per_unit),
    0,
  );

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    pageIngredients.forEach(i => {
      if (i.category) seen.set(i.category, i.category);
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [pageIngredients]);

  const categoryCounts = useMemo(() => {
    return pageIngredients.reduce<Record<string, number>>((acc, i) => {
      acc.all = (acc.all ?? 0) + 1;
      if (i.category) acc[i.category] = (acc[i.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [pageIngredients]);

  const visibleIngredients = useMemo(() => {
    let list = pageIngredients;

    if (categoryFilter !== "all") {
      list = list.filter(i => i.category === categoryFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter(i => resolveStockStatus(i) === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          i.supplier?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q),
      );
    }

    return sortIngredients(list, sort);
  }, [pageIngredients, categoryFilter, statusFilter, search, sort]);

  const hasActiveFilters = !!search || categoryFilter !== "all" || statusFilter !== "all";

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteIngredient.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  const handleStockSave = (resultingQuantity: number) => {
    if (!stockTarget) return;
    updateStock.mutate(
      {
        name: stockTarget.name,
        quantity: resultingQuantity,
        unit: stockTarget.unit,
        cost_per_unit: Number(stockTarget.cost_per_unit),
        supplier: stockTarget.supplier,
        minimum_stock: Number(stockTarget.minimum_stock),
        category: stockTarget.category,
        notes: stockTarget.notes,
      },
      { onSuccess: () => setStockTarget(null) },
    );
  };

  const handleExport = () => {
    exportIngredientsCSV(visibleIngredients);
  };

  return (
    <div className="pb-20 sm:pb-0">
      <PageHeader
        title="Ingredients"
        description="Manage your inventory and track stock levels"
        action={
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handleExport}
              className="btn-secondary"
              style={{ fontSize: 13, padding: "8px 12px" }}
              disabled={visibleIngredients.length === 0}
            >
              <Download size={14} strokeWidth={2} aria-hidden="true" />
              Export
            </button>
            <button onClick={() => navigate("/ingredients/new")} className="btn-primary">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              Add Ingredient
            </button>
          </div>
        }
      />

      {/* Inventory summary */}
      {!isLoading && !isError && (
        <InventorySummaryBar
          totalCount={totalCount}
          lowStockCount={lowStockCount}
          outOfStockCount={outOfStockCount}
          totalValue={totalValue}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search ingredients, suppliers…"
            ariaLabel="Search ingredients"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <PeriodToggle
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={v => setStatusFilter(v as StatusFilter)}
              ariaLabel="Filter by stock status"
            />
            <DropdownMenu
              width={200}
              trigger={({ open }) => (
                <button
                  className="btn-secondary"
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
        </div>

        {categoryOptions.length > 0 && (
          <CategoryFilterBar
            options={categoryOptions}
            active={categoryFilter}
            onChange={setCategoryFilter}
            counts={categoryCounts}
            ariaLabel="Filter by category"
          />
        )}
      </div>

      {/* Loading */}
      {isLoading && <IngredientsSkeleton />}

      {/* Error */}
      {isError && (
        <div
          className="p-8 text-center"
          style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
        >
          <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
            Failed to load ingredients. Please try refreshing the page.
          </p>
        </div>
      )}

      {/* Empty — no ingredients at all */}
      {!isLoading && !isError && totalCount === 0 && (
        <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}>
          <EmptyState
            icon={Package}
            title="No ingredients yet"
            description="Add your first ingredient to start tracking inventory and production costs."
            action={
              <button onClick={() => navigate("/ingredients/new")} className="btn-primary">
                <Plus size={15} aria-hidden="true" />
                Add Ingredient
              </button>
            }
          />
        </div>
      )}

      {/* Empty — filters hide everything */}
      {!isLoading && !isError && totalCount > 0 && visibleIngredients.length === 0 && (
        <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}>
          <EmptyState
            icon={SearchX}
            title="No ingredients match your filters"
            description="Try a different search, category, or status filter."
            action={
              hasActiveFilters ? (
                <button
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setStatusFilter("all");
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

      {/* Content */}
      {!isLoading && !isError && visibleIngredients.length > 0 && (
        <>
          {/* Desktop table */}
          <div
            className="hidden md:block overflow-hidden overflow-x-auto"
            style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
          >
            <table className="w-full text-sm" style={{ minWidth: 760 }}>
              <thead>
                <tr className="table-header-row">
                  {[
                    "Name",
                    "Category",
                    "Current Stock",
                    "Min. Stock",
                    "Cost / Unit",
                    "Supplier",
                    "Status",
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
                {visibleIngredients.map(ingredient => (
                  <IngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    onEdit={() => navigate(`/ingredients/${ingredient.id}/edit`)}
                    onUpdateStock={() => setStockTarget(ingredient)}
                    onDelete={() => setDeleteTarget(ingredient)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {visibleIngredients.map(ingredient => (
              <IngredientCard
                key={ingredient.id}
                ingredient={ingredient}
                onEdit={() => navigate(`/ingredients/${ingredient.id}/edit`)}
                onUpdateStock={() => setStockTarget(ingredient)}
                onDelete={() => setDeleteTarget(ingredient)}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Mobile floating action button */}
      <button
        onClick={() => navigate("/ingredients/new")}
        className="sm:hidden fixed z-30 flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          background: "#FF6FAE",
          boxShadow: "0 8px 24px rgba(255, 111, 174, 0.45)",
        }}
        aria-label="Add a new ingredient"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} aria-hidden="true" />
      </button>

      {/* Update stock modal */}
      <UpdateStockModal
        ingredient={stockTarget}
        loading={updateStock.isPending}
        onSave={handleStockSave}
        onCancel={() => setStockTarget(null)}
      />

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
