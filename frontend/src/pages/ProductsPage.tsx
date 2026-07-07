import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCategories, useDeleteProduct, useProducts, useUpdateProduct } from "@/hooks/useProducts";
import type { Category, Product } from "@/types/product.types";
import { Plus, CakeSlice, SearchX, ArrowUpDown, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SearchInput from "@/components/SearchInput";
import CategoryFilterBar from "@/components/CategoryFilterBar";
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

function sortProducts(products: Product[], sort: SortOption) {
  const list = [...products];
  const timestamp = (value?: string) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  switch (sort) {
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "price_asc":
      return list.sort((a, b) => Number(a.price) - Number(b.price));
    case "price_desc":
      return list.sort((a, b) => Number(b.price) - Number(a.price));
    case "newest":
    default:
      return list.sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at));
  }
}

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

  const { data, isLoading, isError } = useProducts(page);
  const { data: categoriesData } = useCategories();
  const deleteProduct = useDeleteProduct();

  const allProducts: Product[] = data?.data?.results ?? [];
  const categories: Category[] = categoriesData?.data ?? [];
  const categoryOptions = categories
    .filter(category => category.is_active)
    .map(category => ({ value: String(category.id), label: category.name }));
  const totalCount: number = data?.data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);
  const hiddenCount = allProducts.filter(p => !p.is_available).length;

  const visibleProducts = useMemo(() => {
    let list = allProducts;
    if (!showHidden) list = list.filter(p => p.is_available);
    if (categoryFilter !== "all") {
      list = list.filter(p => String(p.category.id) === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
      );
    }
    return sortProducts(list, sort);
  }, [allProducts, showHidden, categoryFilter, search, sort]);

  const categoryCounts = useMemo(() => {
    const base = showHidden ? allProducts : allProducts.filter(p => p.is_available);
    return base.reduce<Record<string, number>>((acc, p) => {
      acc.all = (acc.all ?? 0) + 1;
      const categoryId = String(p.category.id);
      acc[categoryId] = (acc[categoryId] ?? 0) + 1;
      return acc;
    }, {});
  }, [allProducts, showHidden]);

  const groupedByCategory = useMemo(() => {
    if (categoryFilter !== "all") return null;
    return categories.map(category => ({
      category: String(category.id),
      label: category.name,
      items: visibleProducts.filter(p => p.category.id === category.id),
    })).filter(g => g.items.length > 0);
  }, [categories, visibleProducts, categoryFilter]);

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
            ? `${totalCount} product${totalCount !== 1 ? "s" : ""}${hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}`
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
            onChange={setSearch}
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
              onChange={e => setShowHidden(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#FF6FAE" }}
            />
            Show hidden
          </label>
        </div>
        <CategoryFilterBar
          options={categoryOptions}
          active={categoryFilter}
          onChange={setCategoryFilter}
          counts={categoryCounts}
          ariaLabel="Filter by category"
        />
      </div>

      {isLoading && <ProductsSkeleton />}

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
          {groupedByCategory ? (
            <div className="space-y-8">
              {groupedByCategory.map(group => (
                <div key={group.category}>
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <h2
                      className="font-heading font-semibold"
                      style={{ fontSize: 14.5, color: "#6B4226" }}
                    >
                      {group.label}
                    </h2>
                    <span className="font-body" style={{ fontSize: 12.5, color: "#B8A98D" }}>
                      {group.items.length} product{group.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {group.items.map(renderCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map(renderCard)}
            </div>
          )}

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
