import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useIngredients,
  useDeleteIngredient,
  useUpdateStock,
  useLowStockIngredients,
} from "@/hooks/useIngredients";
import type { Ingredient } from "@/types/ingredient.types";
import { Plus, Package, SearchX, Download, LayoutGrid, List, AlertTriangle } from "lucide-react";
import InventorySummaryBar from "@/components/ingredients/InventorySummaryBar";
import IngredientRow from "@/components/ingredients/IngredientRow";
import IngredientCard from "@/components/ingredients/IngredientCard";
import UpdateStockModal from "@/components/ingredients/UpdateStockModal";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { INGREDIENT_CATEGORIES } from "@/types/ingredient.types";
import { useListingPageRecovery } from "@/hooks/useListingPageRecovery";
import { exportIngredientsCSV } from "@/lib/exportIngredientsCSV";
import { ArrowLeftIcon, SearchIcon } from "@/pages/owner-home/OwnerHomeIcons";

type SortOption = "name" | "stock_asc" | "stock_desc" | "value_desc";
type StatusFilter = "all" | "healthy" | "low_stock" | "out_of_stock";

/* ─────────────────────────────────────────────
   SKELETON LOADER
   ───────────────────────────────────────────── */
function IngredientsSkeleton() {
  return (
    <div role="status" aria-label="Loading ingredients…" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-5 border border-[#F5D5E2] animate-pulse space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
          </div>
          <div className="h-5 w-3/4 bg-gray-200 rounded mt-2" />
          <div className="h-3 w-1/2 bg-gray-100 rounded" />
          <div className="h-16 bg-[#FFF9FB] rounded-xl p-3 mt-2" />
          <div className="flex justify-between pt-2">
            <div className="h-7 w-24 bg-gray-200 rounded-full" />
            <div className="h-7 w-14 bg-gray-100 rounded-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading ingredients, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE COMPONENT
   ───────────────────────────────────────────── */
export default function IngredientsPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sort] = useState<SortOption>("name");
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [stockTarget, setStockTarget] = useState<Ingredient | null>(null);

  const ordering = { name: "name", stock_asc: "quantity", stock_desc: "-quantity", value_desc: "-value" }[sort];
  const { data, isLoading, isError, error, refetch } = useIngredients(page, { search, category: categoryFilter, status: statusFilter, ordering });
  useListingPageRecovery(page, error, setPage);
  const { data: lowStockData } = useLowStockIngredients();
  const deleteIngredient = useDeleteIngredient();
  const updateStock = useUpdateStock(stockTarget?.id ?? 0);

  const pageIngredients: Ingredient[] = data?.data?.results ?? [];
  const totalCount: number = data?.data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  const lowStockCount = lowStockData?.length ?? 0;
  const outOfStockCount = pageIngredients.filter(i => Number(i.quantity) <= 0).length;
  const totalValue = pageIngredients.reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.cost_per_unit),
    0,
  );

  const categoryOptions = INGREDIENT_CATEGORIES;
  const visibleIngredients = pageIngredients;

  const hasActiveFilters = !!search || categoryFilter !== "all" || statusFilter !== "all";

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteIngredient.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  const handleStockSave = (delta: string, reason: string) => {
    if (!stockTarget) return;
    updateStock.mutate(
      {
        delta,
        reason,
        revision: stockTarget.stock_revision,
      },
      { onSuccess: () => setStockTarget(null) },
    );
  };

  const handleExport = () => {
    exportIngredientsCSV(visibleIngredients);
  };

  return (
    <div className="subview-shell">
      {/* ─── Subview Header Strip (Breadcrumb + Title + Quick Actions) ─── */}
      <section className="owner-subview-header">
        <div className="owner-subview-left">
          <Link to="/home" className="owner-back-btn" aria-label="Back to Bakery Control Hub">
            <ArrowLeftIcon width={14} height={14} />
            <span>Back to Hub</span>
          </Link>
          <div className="owner-subview-title-group">
            <h1 className="owner-subview-title">Ingredient Inventory</h1>
            <span className="owner-count-pill">
              {totalCount} Items {lowStockCount > 0 && `· ${lowStockCount} Low Stock`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExport}
            disabled={visibleIngredients.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all bg-white shadow-sm cursor-pointer border"
            style={{ borderColor: "#F5D5E2", color: "#7E6570" }}
            onMouseOver={e => {
              e.currentTarget.style.background = "#FFE6F0";
              e.currentTarget.style.color = "#C7255E";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "#FFFFFF";
              e.currentTarget.style.color = "#7E6570";
            }}
          >
            <Download size={13} strokeWidth={2.5} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/ingredients/new")}
            className="owner-action-btn-primary cursor-pointer"
            aria-label="Add new ingredient"
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Add Ingredient</span>
          </button>
        </div>
      </section>

      {/* ─── Inventory Metric Tiles ─── */}
      {!isLoading && !isError && (
        <InventorySummaryBar
          totalCount={totalCount}
          lowStockCount={lowStockCount}
          outOfStockCount={outOfStockCount}
          totalValue={totalValue}
        />
      )}

      {/* ─── Toolbar: Search, Filters & View Toggle ─── */}
      <section
        className="p-4 bg-white rounded-2xl flex flex-col gap-3.5 shadow-sm"
        style={{ border: "1px solid var(--ol-card-border, #F5D5E2)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <SearchIcon
              width={16}
              height={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search flour, sugars, dairy, flavorings, suppliers…"
              className="w-full pl-9 pr-3.5 py-2 text-sm rounded-full bg-[#FFF8FA] text-[#2B1820] outline-none transition-all"
              style={{ border: "1px solid #F5D5E2" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#C7255E";
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#F5D5E2";
                e.currentTarget.style.background = "#FFF8FA";
                e.currentTarget.style.boxShadow = "none";
              }}
              aria-label="Search ingredients"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Filter: Only Low Stock */}
            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === "low_stock" ? "all" : "low_stock");
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: statusFilter === "low_stock" ? "#FFE6F0" : "transparent",
                color: statusFilter === "low_stock" ? "#C7255E" : "#7E6570",
                border: statusFilter === "low_stock" ? "1px solid #C7255E" : "1px solid #F5D5E2",
              }}
            >
              <AlertTriangle size={13} style={{ color: "#C7255E" }} />
              <span>Only Low Stock ({lowStockCount})</span>
            </button>

            {/* View Mode Switcher */}
            <div
              className="inline-flex items-center p-0.5 rounded-full bg-[#FFF8FA]"
              style={{ border: "1px solid #F5D5E2" }}
              role="group"
              aria-label="View layout switch"
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full transition-all border-none cursor-pointer"
                style={{
                  background: viewMode === "cards" ? "#C7255E" : "transparent",
                  color: viewMode === "cards" ? "#FFFFFF" : "#7E6570",
                }}
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full transition-all border-none cursor-pointer"
                style={{
                  background: viewMode === "table" ? "#C7255E" : "transparent",
                  color: viewMode === "table" ? "#FFFFFF" : "#7E6570",
                }}
              >
                <List size={13} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("all");
              setPage(1);
            }}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer flex-shrink-0"
            style={{
              background: categoryFilter === "all" ? "#C7255E" : "#FFFFFF",
              color: categoryFilter === "all" ? "#FFFFFF" : "#7E6570",
              borderColor: categoryFilter === "all" ? "#C7255E" : "#F5D5E2",
              boxShadow: categoryFilter === "all" ? "0 2px 6px rgba(199, 37, 94, 0.2)" : "none",
            }}
          >
            All Categories ({totalCount})
          </button>

          {categoryOptions.map((cat) => {
            const isSelected = categoryFilter === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat.value);
                  setPage(1);
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer flex-shrink-0"
                style={{
                  background: isSelected ? "#C7255E" : "#FFFFFF",
                  color: isSelected ? "#FFFFFF" : "#7E6570",
                  borderColor: isSelected ? "#C7255E" : "#F5D5E2",
                  boxShadow: isSelected ? "0 2px 6px rgba(199, 37, 94, 0.2)" : "none",
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── State: Loading ─── */}
      {isLoading && <IngredientsSkeleton />}

      {/* ─── State: Error ─── */}
      {isError && (
        <div
          className="p-8 text-center bg-white rounded-2xl"
          style={{ border: "1px solid #FECACA" }}
        >
          <p className="text-sm font-semibold text-red-600 mb-2">
            Failed to load pantry ingredients.
          </p>
          <button
            type="button"
            onClick={() => { void refetch(); }}
            className="owner-action-btn-primary"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ─── State: Empty (No ingredients) ─── */}
      {!isLoading && !isError && totalCount === 0 && !hasActiveFilters && (
        <div className="bg-white rounded-2xl p-10 border border-[#F5D5E2] text-center">
          <EmptyState
            icon={Package}
            title="No pantry ingredients yet"
            description="Add your first baking ingredient to begin tracking live inventory levels and batch costing."
            action={
              <button
                type="button"
                onClick={() => navigate("/ingredients/new")}
                className="owner-action-btn-primary"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Add Ingredient</span>
              </button>
            }
          />
        </div>
      )}

      {/* ─── State: Filter Empty (No match) ─── */}
      {!isLoading && !isError && hasActiveFilters && visibleIngredients.length === 0 && (
        <div className="bg-white rounded-2xl p-10 border border-[#F5D5E2] text-center">
          <EmptyState
            icon={SearchX}
            title="No ingredients match your filter"
            description="Try searching with a different ingredient name, category, or clear your active filters."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
                className="px-4 py-2 rounded-full text-xs font-bold border border-[#F5D5E2] text-[#C7255E] bg-[#FFE6F0] cursor-pointer"
              >
                Clear All Filters
              </button>
            }
          />
        </div>
      )}

      {/* ─── Content: Cards or Ledger Table ─── */}
      {!isLoading && !isError && visibleIngredients.length > 0 && (
        <>
          {viewMode === "cards" ? (
            /* Cards View */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {visibleIngredients.map((ingredient) => (
                <IngredientCard
                  key={ingredient.id}
                  ingredient={ingredient}
                  onEdit={() => navigate(`/ingredients/${ingredient.id}/edit`)}
                  onUpdateStock={() => setStockTarget(ingredient)}
                  onDelete={() => setDeleteTarget(ingredient)}
                />
              ))}
            </div>
          ) : (
            /* Table View */
            <div
              className="bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto"
              style={{ border: "1px solid var(--ol-card-border, #F5D5E2)" }}
            >
              <table className="w-full text-left" style={{ minWidth: 840 }}>
                <thead>
                  <tr
                    className="text-[11px] font-bold uppercase tracking-wider text-[#7E6570]"
                    style={{ background: "#FFF8FA", borderBottom: "1px solid #F5D5E2" }}
                  >
                    <th className="px-5 py-3.5">Ingredient &amp; Supplier</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Current Stock</th>
                    <th className="px-5 py-3.5">Min Reorder</th>
                    <th className="px-5 py-3.5">Cost / Unit</th>
                    <th className="px-5 py-3.5">Total Value</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIngredients.map((ingredient) => (
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
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* Quick Stock Update Modal */}
      <UpdateStockModal
        ingredient={stockTarget}
        loading={updateStock.isPending}
        onSave={handleStockSave}
        onCancel={() => setStockTarget(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Pantry Ingredient?"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"? Any baking recipes or formulations referencing this ingredient may be impacted.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        destructive={true}
        loading={deleteIngredient.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
