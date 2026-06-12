import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts, useDeleteProduct } from "@/hooks/useProducts";
import type { Product } from "@/types/product.types";
import { Pencil, Trash2, Plus, ImageOff } from "lucide-react";
import { clsx } from "clsx";

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProducts(page);
  const deleteProduct = useDeleteProduct();

  const products: Product[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20);

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    deleteProduct.mutate(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Products</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your dessert products</p>
        </div>
        <button
          onClick={() => navigate("/products/new")}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}

      {isError && <p className="text-sm text-red-500">Failed to load products.</p>}

      {!isLoading && !isError && products.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No products yet.</p>
          <button
            onClick={() => navigate("/products/new")}
            className="mt-2 text-sm text-slate-600 underline"
          >
            Add your first product
          </button>
        </div>
      )}

      {products.length > 0 && (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Image</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <ImageOff size={14} className="text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{product.name}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {product.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      ₱{Number(product.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          product.is_available
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {product.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/products/${product.id}/edit`)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-slate-500 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1 rounded border disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="text-sm px-3 py-1 rounded border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
