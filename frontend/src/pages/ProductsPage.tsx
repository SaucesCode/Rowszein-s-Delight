import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCategories, useDeleteProduct, useProducts, useUpdateProduct } from "@/hooks/useProducts";
import type { Product, Category } from "@/types/product.types";
import { Plus, SearchX, Eye, EyeOff, LayoutGrid, List } from "lucide-react";
import { useListingPageRecovery } from "@/hooks/useListingPageRecovery";
import ProductCard from "@/components/ProductCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { ArrowLeftIcon, SearchIcon, DonutProductIcon } from "@/pages/owner-home/OwnerHomeIcons";

type ViewMode = "cards" | "table";

/* ─────────────────────────────────────────────
   CONNECTED CARD — owns its own update mutation
   so the availability toggle can live per-card.
   ───────────────────────────────────────────── */
function ConnectedProductCard({
  product,
  onDuplicate,
  onDeleteRequest,
}: {
  product: Product;
  onDuplicate: (product: Product) => void;
  onDeleteRequest: (product: Product) => void;
}) {
  const navigate = useNavigate();
  const updateProduct = useUpdateProduct(product.id);

  const handleToggleAvailability = () => {
    updateProduct.mutate({
      name: product.name,
      description: product.description,
      price: Number(product.price),
      category_id: product.category.id,
      is_available: !product.is_available,
      is_featured: product.is_featured,
      image: null,
    });
  };

  return (
    <ProductCard
      product={product}
      onEdit={() => navigate(`/products/${product.id}/edit`)}
      onDuplicate={() => onDuplicate(product)}
      onToggleAvailability={handleToggleAvailability}
      onDelete={() => onDeleteRequest(product)}
      togglePending={updateProduct.isPending}
    />
  );
}

/* ─────────────────────────────────────────────
   CONNECTED TABLE ROW
   ───────────────────────────────────────────── */
function ConnectedProductTableRow({
  product,
  onEdit,
  onToggleAvailability,
  togglePending,
}: {
  product: Product;
  onEdit: () => void;
  onToggleAvailability: () => void;
  togglePending: boolean;
}) {
  const isAvailable = product.is_available && !product.is_out_of_stock;

  return (
    <tr className="hover:bg-[#FFFDFE] transition-colors">
      <td>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: "#FFE6F0", color: "#C7255E" }}
          >
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <DonutProductIcon width={22} height={22} />
            )}
          </div>
          <div>
            <strong className="block text-sm" style={{ color: "#2B1820" }}>
              {product.name}
            </strong>
            <span className="block text-xs text-gray-500 truncate max-w-xs">
              {product.description || "Fresh artisan donut"}
            </span>
          </div>
        </div>
      </td>
      <td>
        <span className="detail-sub-chip">{product.category?.name ?? "Donut"}</span>
      </td>
      <td>
        <strong className="text-sm font-extrabold" style={{ color: "#C7255E" }}>
          ₱{Number(product.price).toFixed(2)}
        </strong>
      </td>
      <td>
        <span
          className={`badge-status ${
            product.is_out_of_stock ? "soldout" : product.is_available ? "available" : "hidden"
          }`}
        >
          {product.is_out_of_stock ? "Sold Out" : product.is_available ? "Available" : "Hidden"}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit} className="btn-table-action">
            Edit
          </button>
          <button
            type="button"
            onClick={onToggleAvailability}
            disabled={togglePending}
            className="btn-table-action"
            style={{ color: "#7E6570" }}
          >
            {isAvailable ? "Hide" : "Unhide"}
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────
   SKELETON
   ───────────────────────────────────────────── */
function ProductsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading products…"
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white overflow-hidden animate-pulse"
          style={{ borderRadius: 16, border: "1px solid #F5D5E2" }}
        >
          <div style={{ height: 160, background: "#FFE6F0" }} />
          <div className="p-4 space-y-2.5">
            <div style={{ height: 10, width: "35%", background: "#F5D5E2", borderRadius: 4 }} />
            <div style={{ height: 16, width: "70%", background: "#F5D5E2", borderRadius: 4 }} />
            <div style={{ height: 12, width: "90%", background: "#FDF0F5", borderRadius: 4 }} />
            <div className="flex justify-between pt-2">
              <div style={{ height: 18, width: "30%", background: "#F5D5E2", borderRadius: 4 }} />
              <div style={{ height: 12, width: "25%", background: "#FDF0F5", borderRadius: 4 }} />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PRODUCTS PAGE (CONCEPT 1 BOUTIQUE SHOWCASE)
   ───────────────────────────────────────────── */
export default function ProductsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: categoriesData } = useCategories();
  const categories: Category[] = categoriesData?.data ?? [];

  const { data, isLoading, isError, error, refetch } = useProducts(page, {
    search,
    category: categoryFilter,
    ordering: "-created_at",
    is_available: showHidden ? undefined : true,
  });

  useListingPageRecovery(page, error, setPage);
  const deleteProduct = useDeleteProduct();

  const visibleProducts: Product[] = data?.data.results ?? [];
  const totalCount = data?.data.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);
  const hiddenCount = visibleProducts.filter((product) => !product.is_available).length;
  const activeCount = visibleProducts.filter((product) => product.is_available && !product.is_out_of_stock).length;

  const hasActiveFilters = !!search || categoryFilter !== "all" || showHidden;

  const handleDuplicate = (product: Product) => {
    navigate("/products/new", {
      state: {
        duplicate: {
          name: `${product.name} (Copy)`,
          description: product.description,
          price: Number(product.price),
          category_id: product.category.id,
        },
      },
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteProduct.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  return (
    <div className="subview-shell">
      {/* ─── Subview Header Strip (Breadcrumb + Title + Action) ─── */}
      <section className="owner-subview-header">
        <div className="owner-subview-left">
          <Link to="/home" className="owner-back-btn" aria-label="Back to Bakery Control Hub">
            <ArrowLeftIcon width={14} height={14} />
            <span>Back to Hub</span>
          </Link>
          <div className="owner-subview-title-group">
            <h1 className="owner-subview-title">Donut Products</h1>
            <span className="owner-count-pill">
              {activeCount} Active {hiddenCount > 0 && `· ${hiddenCount} Hidden`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/products/new")}
          className="owner-action-btn-primary"
          aria-label="Add a new donut product"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>Add New Donut</span>
        </button>
      </section>

      {/* ─── Toolbar: Search, Filters & View Toggle ─── */}
      <section
        className="p-4 bg-white rounded-2xl flex flex-col gap-3.5 shadow-sm"
        style={{ border: "1px solid var(--ol-card-border, #F5D5E2)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Field */}
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
              placeholder="Search donuts by flavor, glaze, or recipe…"
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
              aria-label="Search donuts"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Show Hidden Toggle Pill */}
            <button
              type="button"
              onClick={() => {
                setShowHidden(!showHidden);
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: showHidden ? "#FFE6F0" : "transparent",
                color: showHidden ? "#C7255E" : "#7E6570",
                border: showHidden ? "1px solid #C7255E" : "1px solid #F5D5E2",
              }}
            >
              {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>Show Hidden</span>
            </button>

            {/* View Mode Segmented Switcher */}
            <div
              className="inline-flex p-0.5 rounded-full"
              style={{ background: "#FFF8FA", border: "1px solid #F5D5E2" }}
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: viewMode === "cards" ? "#FFFFFF" : "transparent",
                  color: viewMode === "cards" ? "#C7255E" : "#7E6570",
                  boxShadow: viewMode === "cards" ? "0 1px 3px rgba(43,24,32,0.06)" : "none",
                  fontWeight: viewMode === "cards" ? 700 : 500,
                }}
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: viewMode === "table" ? "#FFFFFF" : "transparent",
                  color: viewMode === "table" ? "#C7255E" : "#7E6570",
                  boxShadow: viewMode === "table" ? "0 1px 3px rgba(43,24,32,0.06)" : "none",
                  fontWeight: viewMode === "table" ? 700 : 500,
                }}
              >
                <List size={13} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("all");
              setPage(1);
            }}
            className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              background: categoryFilter === "all" ? "#C7255E" : "transparent",
              color: categoryFilter === "all" ? "#FFFFFF" : "#7E6570",
              border: categoryFilter === "all" ? "1px solid #C7255E" : "1px solid #F5D5E2",
            }}
          >
            All Donuts ({totalCount})
          </button>
          {categories
            .filter((cat) => cat.is_active)
            .map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(String(cat.id));
                  setPage(1);
                }}
                className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  background: categoryFilter === String(cat.id) ? "#C7255E" : "transparent",
                  color: categoryFilter === String(cat.id) ? "#FFFFFF" : "#7E6570",
                  border: categoryFilter === String(cat.id) ? "1px solid #C7255E" : "1px solid #F5D5E2",
                }}
              >
                {cat.name}
              </button>
            ))}
        </div>
      </section>

      {/* ─── State: Loading ─── */}
      {isLoading && <ProductsSkeleton />}

      {/* ─── State: Error ─── */}
      {isError && (
        <div
          className="p-8 text-center bg-white rounded-2xl shadow-sm"
          style={{ border: "1px solid #F5D5E2" }}
        >
          <p className="text-sm text-red-600 mb-3">Failed to load donut products. Please try refreshing.</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="owner-action-btn-primary"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* ─── State: Empty ─── */}
      {!isLoading && !isError && visibleProducts.length === 0 && (
        <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: "1px solid #F5D5E2" }}>
          <EmptyState
            icon={SearchX}
            title={hasActiveFilters ? "No donuts match your filters" : "No donuts created yet"}
            description={
              hasActiveFilters
                ? "Try clearing your search query or selecting a different category."
                : "Add your first freshly baked donut product to start building your bakery menu."
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setShowHidden(false);
                    setPage(1);
                  }}
                  className="owner-action-btn-secondary"
                >
                  Clear all filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/products/new")}
                  className="owner-action-btn-primary"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Add First Donut</span>
                </button>
              )
            }
          />
        </div>
      )}

      {/* ─── State: Content (Cards or Table) ─── */}
      {!isLoading && !isError && visibleProducts.length > 0 && (
        <>
          {viewMode === "cards" ? (
            /* CONCEPT 1: BOUTIQUE SHOWCASE CARD GRID */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {visibleProducts.map((product) => (
                <ConnectedProductCard
                  key={product.id}
                  product={product}
                  onDuplicate={handleDuplicate}
                  onDeleteRequest={setDeleteTarget}
                />
              ))}
            </div>
          ) : (
            /* CONCEPT 2: BOUTIQUE CLEAN LEDGER TABLE */
            <div className="table-container-responsive">
              <table className="clean-table" aria-label="Donut Products Table">
                <thead>
                  <tr>
                    <th scope="col">Donut Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Unit Price</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => {
                    return (
                      <ConnectedProductTableRow
                        key={product.id}
                        product={product}
                        onEdit={() => navigate(`/products/${product.id}/edit`)}
                        onToggleAvailability={() => {
                          // Handled via edit or quick mutation
                          navigate(`/products/${product.id}/edit`);
                        }}
                        togglePending={false}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* ─── Delete Confirmation Dialog ─── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Donut Product?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed from your catalog and menu. If you just want to remove it from customer view temporarily, you can use "Hide from shop" instead.`
            : ""
        }
        confirmLabel="Delete permanently"
        destructive
        loading={deleteProduct.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
