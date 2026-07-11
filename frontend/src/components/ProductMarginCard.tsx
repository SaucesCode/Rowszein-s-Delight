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

function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function marginBadgeClass(margin: number) {
  if (margin >= 60) return "badge-success";
  if (margin >= 30) return "badge-warning";
  return "badge-danger";
}

export default function ProductMarginCard({ product }: { product: ProductMargin }) {
  return (
    <div
      className="p-4"
      style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 12 }}
    >
      {/* Name + availability */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="font-heading font-semibold"
          style={{ fontSize: 14, color: "#6B4226" }}
        >
          {product.product_name}
        </p>
        <span className={product.is_available ? "badge badge-success" : "badge badge-neutral"}>
          {product.is_available ? "Available" : "Unavailable"}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-end flex-wrap gap-x-4 gap-y-1.5 mt-3">
        <div>
          <p
            className="font-body"
            style={{
              fontSize: 10.5,
              color: "#B8A98D",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Selling Price
          </p>
          <p className="font-body font-semibold" style={{ fontSize: 13, color: "#3D3A35" }}>
            {formatPeso(product.selling_price)}
          </p>
        </div>

        <div>
          <p
            className="font-body"
            style={{
              fontSize: 10.5,
              color: "#B8A98D",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Production Cost
          </p>
          {product.has_recipe ? (
            <p className="font-body font-semibold" style={{ fontSize: 13, color: "#3D3A35" }}>
              {formatPeso(product.production_cost)}
            </p>
          ) : (
            <span className="badge badge-neutral">No recipe</span>
          )}
        </div>

        {product.has_recipe && (
          <div>
            <p
              className="font-body"
              style={{
                fontSize: 10.5,
                color: "#B8A98D",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Profit / Unit
            </p>
            <p
              className="font-body font-semibold"
              style={{
                fontSize: 13,
                color: product.profit_per_unit >= 0 ? "#15803D" : "#B91C1C",
              }}
            >
              {formatPeso(product.profit_per_unit)}
            </p>
          </div>
        )}

        {product.has_recipe && (
          <div className="ml-auto">
            <p
              className="font-body text-right"
              style={{
                fontSize: 10.5,
                color: "#B8A98D",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Margin
            </p>
            <span className={`badge ${marginBadgeClass(product.margin_percent)}`}>
              {product.margin_percent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}