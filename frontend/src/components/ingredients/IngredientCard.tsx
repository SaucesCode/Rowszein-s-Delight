import { Package, MoreVertical, Pencil, PackageOpen, Trash2 } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";
import StockStatusBadge, { resolveStockStatus } from "./StockStatusBadge";
import DropdownMenu from "@/components/DropdownMenu";

interface IngredientCardProps {
  ingredient: Ingredient;
  onEdit: () => void;
  onUpdateStock: () => void;
  onDelete: () => void;
}

export default function IngredientCard({
  ingredient,
  onEdit,
  onUpdateStock,
  onDelete,
}: IngredientCardProps) {
  const status = resolveStockStatus(ingredient);
  const stockColor =
    status === "healthy" ? "#3D3A35" : status === "low_stock" ? "#946200" : "#B91C1C";

  return (
    <div
      className="flex items-start gap-3 p-4"
      style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 12 }}
    >
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0 overflow-hidden"
        style={{ width: 40, height: 40, background: "#FFF0F7" }}
      >
        {ingredient.image_url ? (
          <img
            src={ingredient.image_url}
            alt={ingredient.name}
            className="w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <Package size={17} style={{ color: "#FF6FAE" }} aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="font-heading font-semibold truncate"
              style={{ fontSize: 14, color: "#6B4226" }}
            >
              {ingredient.name}
            </p>
            <p className="font-body" style={{ fontSize: 12, color: "#9B6644" }}>
              {ingredient.category ?? "Uncategorized"}
            </p>
          </div>

          <DropdownMenu
            width={190}
            trigger={({ open }) => (
              <button
                className="flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
                style={{ width: 28, height: 28, color: "#A8A49B", background: open ? "#F5EDE0" : "transparent" }}
                aria-label={`Actions for ${ingredient.name}`}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <MoreVertical size={15} aria-hidden="true" />
              </button>
            )}
          >
            <button
              onClick={onEdit}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
              style={{ fontSize: 13, color: "#6B4226" }}
            >
              <Pencil size={14} style={{ color: "#9B6644" }} aria-hidden="true" />
              Edit
            </button>
            <button
              onClick={onUpdateStock}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
              style={{ fontSize: 13, color: "#6B4226", borderTop: "1px solid #F5EDE0" }}
            >
              <PackageOpen size={14} style={{ color: "#9B6644" }} aria-hidden="true" />
              Update Stock
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FEF2F2]"
              style={{ fontSize: 13, color: "#DC2626", borderTop: "1px solid #F5EDE0" }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
          </DropdownMenu>
        </div>

        <div className="flex items-end flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
          <div>
            <p
              className="font-body"
              style={{ fontSize: 10.5, color: "#B8A98D", textTransform: "uppercase", letterSpacing: "0.04em" }}
            >
              Stock
            </p>
            <p className="font-body font-semibold" style={{ fontSize: 13, color: stockColor }}>
              {Number(ingredient.quantity).toLocaleString("en-PH")} {ingredient.unit}
            </p>
          </div>
          <div>
            <p
              className="font-body"
              style={{ fontSize: 10.5, color: "#B8A98D", textTransform: "uppercase", letterSpacing: "0.04em" }}
            >
              Cost / Unit
            </p>
            <p className="font-body font-semibold" style={{ fontSize: 13, color: "#3D3A35" }}>
              ₱{Number(ingredient.cost_per_unit).toFixed(2)}
            </p>
          </div>
          {ingredient.supplier && (
            <div className="min-w-0">
              <p
                className="font-body"
                style={{ fontSize: 10.5, color: "#B8A98D", textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                Supplier
              </p>
              <p className="font-body font-semibold truncate" style={{ fontSize: 13, color: "#3D3A35" }}>
                {ingredient.supplier}
              </p>
            </div>
          )}
          <div className="ml-auto">
            <StockStatusBadge status={status} />
          </div>
        </div>
      </div>
    </div>
  );
}