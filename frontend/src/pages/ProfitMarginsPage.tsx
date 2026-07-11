import { useProductMargins } from "@/hooks/useDashboard";
import { TrendingUp } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import SkeletonTable from "@/components/SkeletonTable";
import PageHeader from "@/components/PageHeader";
import ProductMarginCard from "@/components/ProductMarginCard";

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ─────────────────────────────────────────────
   MARGIN BADGE
   ───────────────────────────────────────────── */
function MarginBadge({ margin }: { margin: number }) {
  const config =
    margin >= 60
      ? { cls: "badge-success", label: `${margin.toFixed(1)}%` }
      : margin >= 30
        ? { cls: "badge-warning", label: `${margin.toFixed(1)}%` }
        : { cls: "badge-danger", label: `${margin.toFixed(1)}%` };

  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}

/* ─────────────────────────────────────────────
   SUMMARY CARD
   ───────────────────────────────────────────── */
function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-surface p-5">
      <p className="font-body" style={{ fontSize: 12, color: "#9B6644", fontWeight: 500 }}>
        {label}
      </p>
      <p
        className="font-heading font-semibold mt-1"
        style={{ fontSize: 22, color: "#6B4226", lineHeight: 1.2 }}
      >
        {value}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function ProfitMarginsPage() {
  const { data, isLoading, isError } = useProductMargins();

  const products: ProductMargin[] = data ?? [];

  const productsWithRecipe = products.filter(p => p.has_recipe);

  const avgMargin =
    productsWithRecipe.length > 0
      ? productsWithRecipe.reduce((sum, p) => sum + p.margin_percent, 0) /
        productsWithRecipe.length
      : 0;

  const highMarginCount = productsWithRecipe.filter(p => p.margin_percent >= 60).length;

  return (
    <div>
      <PageHeader
        title="Profit Margins"
        description="Selling price vs production cost per product"
      />

      {/* Loading */}
      {isLoading && <SkeletonTable rows={5} cols={6} />}

      {/* Error */}
      {isError && (
        <div className="card-surface p-6 text-center">
          <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
            Failed to load profit margins. Please try refreshing the page.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && products.length === 0 && (
        <div className="card-surface">
          <EmptyState
            icon={TrendingUp}
            title="No products yet"
            description="Add products and define their recipes to see profit margin calculations here."
          />
        </div>
      )}

      {!isLoading && !isError && products.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
            <SummaryCard label="Total Products" value={products.length} />
            <SummaryCard label="With Recipe" value={productsWithRecipe.length} />
            <SummaryCard label="Avg Margin" value={`${avgMargin.toFixed(1)}%`} />
            <SummaryCard label="High Margin (≥60%)" value={highMarginCount} />
          </div>

          {/* Desktop table */}
          <div
            className="hidden md:block overflow-hidden overflow-x-auto"
            style={{
              background: "#FFFDFB",
              border: "1px solid #E8E6E1",
              borderRadius: 10,
            }}
          >
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr className="table-header-row">
                  {[
                    "Product",
                    "Selling Price",
                    "Production Cost",
                    "Profit / Unit",
                    "Margin",
                    "Status",
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
                {products.map((product, idx) => (
                  <tr
                    key={product.product_id}
                    className="table-row-hover transition-colors"
                    style={{
                      borderBottom: "1px solid #F5EDE0",
                      background: idx % 2 !== 0 ? "#FFF8F0" : undefined,
                    }}
                  >
                    {/* Product name */}
                    <td className="px-4 py-3.5">
                      <span
                        className="font-heading font-medium"
                        style={{ fontSize: 13, color: "#6B4226" }}
                      >
                        {product.product_name}
                      </span>
                    </td>

                    {/* Selling price */}
                    <td
                      className="px-4 py-3.5 font-body"
                      style={{ fontSize: 13, color: "#3D3A35", fontWeight: 500 }}
                    >
                      {formatPeso(product.selling_price)}
                    </td>

                    {/* Production cost */}
                    <td className="px-4 py-3.5 font-body" style={{ fontSize: 13 }}>
                      {product.has_recipe ? (
                        <span style={{ color: "#3D3A35" }}>
                          {formatPeso(product.production_cost)}
                        </span>
                      ) : (
                        <span className="badge badge-neutral">No recipe</span>
                      )}
                    </td>

                    {/* Profit per unit */}
                    <td className="px-4 py-3.5 font-body" style={{ fontSize: 13 }}>
                      {product.has_recipe ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color: product.profit_per_unit >= 0 ? "#15803D" : "#B91C1C",
                          }}
                        >
                          {formatPeso(product.profit_per_unit)}
                        </span>
                      ) : (
                        <span style={{ color: "#D1CEC7" }}>—</span>
                      )}
                    </td>

                    {/* Margin badge */}
                    <td className="px-4 py-3.5">
                      {product.has_recipe ? (
                        <MarginBadge margin={product.margin_percent} />
                      ) : (
                        <span style={{ color: "#D1CEC7", fontSize: 13 }}>—</span>
                      )}
                    </td>

                    {/* Availability */}
                    <td className="px-4 py-3.5">
                      <span
                        className={
                          product.is_available ? "badge badge-success" : "badge badge-neutral"
                        }
                      >
                        {product.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {products.map(product => (
              <ProductMarginCard key={product.product_id} product={product} />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <p className="font-body" style={{ fontSize: 12, color: "#A8A49B" }}>
              Margin guide:
            </p>
            <span className="badge badge-success">≥ 60% Good</span>
            <span className="badge badge-warning">30–59% Fair</span>
            <span className="badge badge-danger">&lt; 30% Low</span>
          </div>
        </>
      )}
    </div>
  );
}
