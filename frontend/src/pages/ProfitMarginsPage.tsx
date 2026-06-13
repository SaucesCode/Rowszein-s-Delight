import { useProductMargins } from "@/hooks/useDashboard";
import { clsx } from "clsx";

interface ProductMargin {
  product_id: number;
  product_name: string;
  selling_price: number;
  production_cost: number;
  profit_per_unit: number;
  margin_percent: number;
  has_recipe: boolean;
  is_available: boolean;
}

function MarginBadge({ margin }: { margin: number }) {
  const color =
    margin >= 60
      ? "bg-green-100 text-green-700"
      : margin >= 30
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";

  return (
    <span className={clsx("px-2 py-1 rounded-full text-xs font-medium", color)}>
      {margin.toFixed(1)}%
    </span>
  );
}

function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ProfitMarginsPage() {
  const { data, isLoading, isError } = useProductMargins();

  const products: ProductMargin[] = data ?? [];

  const avgMargin =
    products.filter(p => p.has_recipe).length > 0
      ? products.filter(p => p.has_recipe).reduce((sum, p) => sum + p.margin_percent, 0) /
        products.filter(p => p.has_recipe).length
      : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Profit Margins</h1>
        <p className="text-sm text-slate-500 mt-1">
          Selling price vs production cost per product
        </p>
      </div>

      {/* Summary Cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500 mb-1">Total Products</p>
            <p className="text-2xl font-semibold text-slate-800">{products.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500 mb-1">With Recipe</p>
            <p className="text-2xl font-semibold text-slate-800">
              {products.filter(p => p.has_recipe).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500 mb-1">Avg Margin</p>
            <p className="text-2xl font-semibold text-slate-800">{avgMargin.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}

      {isError && <p className="text-sm text-red-500">Failed to load profit margins.</p>}

      {!isLoading && !isError && products.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No products found.</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Selling Price</th>
                <th className="px-4 py-3 font-medium">Production Cost</th>
                <th className="px-4 py-3 font-medium">Profit / Unit</th>
                <th className="px-4 py-3 font-medium">Margin</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(product => (
                <tr key={product.product_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {product.product_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatPeso(product.selling_price)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {product.has_recipe ? (
                      formatPeso(product.production_cost)
                    ) : (
                      <span className="text-slate-400 text-xs">No recipe</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {product.has_recipe ? (
                      <span
                        className={clsx(
                          "font-medium",
                          product.profit_per_unit >= 0 ? "text-green-600" : "text-red-500",
                        )}
                      >
                        {formatPeso(product.profit_per_unit)}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {product.has_recipe ? (
                      <MarginBadge margin={product.margin_percent} />
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <p className="text-xs text-slate-400">Margin indicator:</p>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          ≥ 60% Good
        </span>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          30–59% Fair
        </span>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          &lt; 30% Low
        </span>
      </div>
    </div>
  );
}
