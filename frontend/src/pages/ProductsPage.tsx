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
        <div className="card-surface p-8 text-center">
          <p className="font-body text-sm" style={{ color: "#EF4444" }}>
            Failed to load products. Please try refreshing the page.
          </p>
        </div>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <div className="card-surface">
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
          <div
            className="table-container overflow-hidden overflow-x-auto"
            style={{
              background: "#FFFDFB",
              border: "1px solid #E8E6E1",
            }}
          >
            <table className="w-full" style={{ minWidth: 620 }}>
              <thead>
                <tr className="table-header-row">
                  {["Image", "Name", "Description", "Price", "Status", "Actions"].map(col => (
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
                {products.map((product, idx) => (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-brand-pink-light"
                    style={{
                      borderBottom: "1px solid #F5EDE0",
                      background: idx % 2 !== 0 ? "#FFF8F0" : undefined,
                    }}
                  >
                    {/* Image */}
                    <td className="px-5 py-4">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="rounded-lg object-cover"
                          style={{
                            width: 44,
                            height: 44,
                            border: "1px solid #F5EDE0",
                          }}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center rounded-lg"
                          style={{
                            width: 44,
                            height: 44,
                            background: "#FFF0F7",
                            border: "1px solid #FFD6E7",
                          }}
                        >
                          <ImageOff
                            size={16}
                            style={{ color: "#FF6FAE" }}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </div>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-5 py-4">
                      <span
                        className="font-heading font-medium"
                        style={{ fontSize: 14, color: "#6B4226", fontWeight: 600 }}
                      >
                        {product.name}
                      </span>
                    </td>

                    {/* Description */}
                    <td
                      className="px-5 py-4 font-body max-w-xs"
                      style={{ fontSize: 14, color: "#7C7870" }}
                    >
                      <span className="line-clamp-1">
                        {product.description || <span style={{ color: "#D1CEC7" }}>—</span>}
                      </span>
                    </td>

                    {/* Price */}
                    <td
                      className="px-5 py-4 font-body"
                      style={{ fontSize: 14, color: "#3D3A35", fontWeight: 600 }}
                    >
                      ₱{Number(product.price).toFixed(2)}
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-4">
                      <span
                        className={clsx(
                          "badge",
                          product.is_available ? "badge-success" : "badge-neutral",
                        )}
                      >
                        {product.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="table-cell-action">
                        <button
                          onClick={() => navigate(`/products/${product.id}/edit`)}
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
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(product)}
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
