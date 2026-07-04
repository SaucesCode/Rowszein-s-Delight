import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts, useDeleteProduct } from "@/hooks/useProducts";
import type { Product } from "@/types/product.types";
import { Plus, Pencil, Trash2, ImageOff, CakeSlice } from "lucide-react";
import { clsx } from "clsx";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import SkeletonTable from "@/components/SkeletonTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useProducts(page);
  const deleteProduct = useDeleteProduct();

  const products: Product[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteProduct.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your dessert menu and pricing"
        action={
          <button onClick={() => navigate("/products/new")} className="btn-primary">
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            Add Product
          </button>
        }
      />

      {isLoading && <SkeletonTable rows={6} cols={6} />}

      {isError && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm" style={{ color: "#ef4444" }}>
            Failed to load products. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <EmptyState
            icon={CakeSlice}
            title="No products yet"
            description="Add your first product to start building your dessert menu."
            action={
              <button onClick={() => navigate("/products/new")} className="btn-primary">
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                Add Product
              </button>
            }
          />
        </div>
      )}

      {!isLoading && !isError && products.length > 0 && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 620 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    {["Image", "Name", "Description", "Price", "Status", "Actions"].map(col => (
                      <th
                        key={col}
                        className="px-6 py-4 text-left font-medium"
                        style={{ color: "#64748b", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-gray-50"
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      {/* Image */}
                      <td className="px-6 py-4">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="rounded-lg object-cover"
                            style={{
                              width: 44,
                              height: 44,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                        ) : (
                          <div
                            className="flex items-center justify-center rounded-lg"
                            style={{
                              width: 44,
                              height: 44,
                              background: "#fce7f3",
                              border: "1px solid #fbcfe8",
                            }}
                          >
                            <ImageOff
                              size={16}
                              style={{ color: "#ec4899" }}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <span
                          className="font-heading font-semibold"
                          style={{ fontSize: 14, color: "#0f172a" }}
                        >
                          {product.name}
                        </span>
                      </td>

                      {/* Description */}
                      <td
                        className="px-6 py-4 font-body max-w-xs"
                        style={{ fontSize: 14, color: "#64748b" }}
                      >
                        <span className="line-clamp-1">
                          {product.description || <span style={{ color: "#cbd5e1" }}>—</span>}
                        </span>
                      </td>

                      {/* Price */}
                      <td
                        className="px-6 py-4 font-body"
                        style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}
                      >
                        ₱{Number(product.price).toFixed(2)}
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4">
                        <span
                          className={clsx(
                            "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold",
                            product.is_available
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700",
                          )}
                        >
                          {product.is_available ? "Available" : "Unavailable"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/products/${product.id}/edit`)}
                            className="rounded-lg p-2 transition-colors"
                            style={{ color: "#cbd5e1" }}
                            onMouseOver={e => {
                              (e.currentTarget as HTMLElement).style.background = "#f5f6f8";
                              (e.currentTarget as HTMLElement).style.color = "#ec4899";
                            }}
                            onMouseOut={e => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "#cbd5e1";
                            }}
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="rounded-lg p-2 transition-colors"
                            style={{ color: "#cbd5e1" }}
                            onMouseOver={e => {
                              (e.currentTarget as HTMLElement).style.background = "#fee2e2";
                              (e.currentTarget as HTMLElement).style.color = "#ef4444";
                            }}
                            onMouseOut={e => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "#cbd5e1";
                            }}
                            aria-label={`Delete ${product.name}`}
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
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete product?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed from your menu. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteProduct.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
