import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteProduct, useProducts, useUpdateProduct } from "@/hooks/useProducts";
import type { Product } from "@/types/product.types";
import { Plus, CakeSlice, SearchX, ArrowUpDown, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SearchInput from "@/components/SearchInput";
import PaginatedLookup from "@/components/PaginatedLookup";
import { useListingPageRecovery } from "@/hooks/useListingPageRecovery";
import DropdownMenu from "@/components/DropdownMenu";
import ProductCard from "@/components/ProductCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";

type SortOption = "name" | "newest" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

/* ─────────────────────────────────────────────
   CONNECTED CARD — owns its own update mutation
   so the availability toggle can live per-card
   without breaking the rules of hooks.
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
   SKELETON
   ───────────────────────────────────────────── */
function ProductsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading products…"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E8E6E1" }}
        >
          <div className="skeleton" style={{ aspectRatio: "4 / 3", borderRadius: 0 }} />
          <div className="p-3.5 space-y-2">
            <div className="skeleton" style={{ height: 9, width: "40%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 14, width: "75%", borderRadius: 5 }} />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function ProductsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showHidden, setShowHidden] = useState(false);
  const [sort, setSort] = useState<SortOption>("newest");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const ordering = { newest: "-created_at", name: "name", price_asc: "price", price_desc: "-price" }[sort];
  const { data, isLoading, isError, error, refetch } = useProducts(page, { search, category: categoryFilter, ordering, is_available: showHidden ? undefined : true });
  useListingPageRecovery(page, error, setPage);
  const deleteProduct = useDeleteProduct();
  const visibleProducts: Product[] = data?.data.results ?? [];
  const totalCount = data?.data.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);
  const hiddenCount = visibleProducts.filter(product => !product.is_available).length;

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

  const renderCard = (product: Product) => (
    <ConnectedProductCard
      key={product.id}
      product={product}
      onDuplicate={handleDuplicate}
      onDeleteRequest={setDeleteTarget}
    />
  );

  return (
    <div className="pb-20 sm:pb-0">
      <PageHeader
        title="Products"
        description={
          !isLoading && !isError
            ? `${totalCount} matching product${totalCount !== 1 ? "s" : ""}${hiddenCount > 0 ? ` · ${hiddenCount} hidden on this page` : ""}`
            : "Manage your dessert menu and pricing"
        }
        action={
          <div className="hidden sm:flex items-center gap-2">
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
                  onClick={() => { setSort(opt.value); setPage(1); }}
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
            <button onClick={() => navigate("/products/new")} className="btn-primary">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              Add Product
            </button>
          </div>
        }
      />

      {/* Filter row */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput
            value={search}
            onChange={value => { setSearch(value); setPage(1); }}
            placeholder="Search products…"
            ariaLabel="Search products"
          />
          <label
            className="flex items-center gap-2 flex-shrink-0 font-body cursor-pointer select-none"
            style={{ fontSize: 13, color: "#7C5A3D" }}
          >
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => { setShowHidden(e.target.checked); setPage(1); }}
              style={{ width: 16, height: 16, accentColor: "#FF6FAE" }}
            />
            Show hidden
          </label>
        </div>
        <PaginatedLookup kind="categories" label="Filter by category" selectedId={Number(categoryFilter) || 0}
          params={{ is_active: true }} onChange={event => { setCategoryFilter(event.target.value === "0" ? "all" : event.target.value); setPage(1); }} />
      </div>

      {isLoading && <ProductsSkeleton />}
      {isError && <button type="button" onClick={() => { void refetch(); }}>Retry products</button>}

      {isError && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm" style={{ color: "#ef4444" }}>
            Failed to load products. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && visibleProducts.length === 0 && (
        <div style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 16 }}>
          <EmptyState
            icon={hasActiveFilters ? SearchX : CakeSlice}
            title={hasActiveFilters ? "No products match your filters" : "No products yet"}
            description={
              hasActiveFilters
                ? "Try a different search, category, or clear filters."
                : "Add your first product to start building your dessert menu."
            }
            action={
              hasActiveFilters ? (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                    setCategoryFilter("all");
                    setShowHidden(false);
                  }}
                  className="btn-secondary"
                >
                  Clear filters
                </button>
              ) : (
                <button onClick={() => navigate("/products/new")} className="btn-primary">
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  Add Product
                </button>
              )
            }
          />
        </div>
      )}

      {!isLoading && !isError && visibleProducts.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map(renderCard)}
          </div>
          <div className="mt-6">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* Mobile floating action button */}
      <button
        onClick={() => navigate("/products/new")}
        className="sm:hidden fixed z-30 flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          background: "#FF6FAE",
          boxShadow: "0 8px 24px rgba(255, 111, 174, 0.45)",
        }}
        aria-label="Add a new product"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete product permanently?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed and cannot be recovered. If you might bring it back later, consider using "Hide from shop" instead.`
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
