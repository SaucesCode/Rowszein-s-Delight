import { Package, MoreVertical, Pencil, PackageOpen, Trash2 } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";
import StockStatusBadge, { resolveStockStatus } from "./StockStatusBadge";
import DropdownMenu from "@/components/DropdownMenu";

interface IngredientRowProps {
  ingredient: Ingredient;
  onEdit: () => void;
  onUpdateStock: () => void;
  onDelete: () => void;
}

export default function IngredientRow({
  ingredient,
  onEdit,
  onUpdateStock,
  onDelete,
}: IngredientRowProps) {
  const status = resolveStockStatus(ingredient);
  const stockColor =
    status === "healthy" ? "#3D3A35" : status === "low_stock" ? "#946200" : "#B91C1C";

  return (
    <tr
      className="table-row-hover transition-colors"
      style={{ borderBottom: "1px solid #F5EDE0" }}
    >
      {/* Image + name */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0 overflow-hidden"
            style={{ width: 34, height: 34, background: "#FFF0F7" }}
          >
            {ingredient.image_url ? (
              <img
                src={ingredient.image_url}
                alt={ingredient.name}
                className="w-full h-full"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <Package size={15} style={{ color: "#FF6FAE" }} aria-hidden="true" />
            )}
          </div>
          <span
            className="font-heading font-medium"
            style={{ fontSize: 13, color: "#6B4226" }}
          >
            {ingredient.name}
          </span>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-3.5 font-body" style={{ fontSize: 13, color: "#9B6644" }}>
        {ingredient.category ?? <span style={{ color: "#D1CEC7" }}>—</span>}
      </td>

      {/* Current stock */}
      <td
        className="px-4 py-3.5 font-body"
        style={{
          fontSize: 13,
          color: stockColor,
          fontWeight: status === "healthy" ? 500 : 700,
        }}
      >
        {Number(ingredient.quantity).toLocaleString("en-PH")} {ingredient.unit}
      </td>

      {/* Minimum stock */}
      <td className="px-4 py-3.5 font-body" style={{ fontSize: 13, color: "#9B6644" }}>
        {Number(ingredient.minimum_stock) > 0 ? (
          `${Number(ingredient.minimum_stock).toLocaleString("en-PH")} ${ingredient.unit}`
        ) : (
          <span style={{ color: "#D1CEC7" }}>—</span>
        )}
      </td>

      {/* Cost per unit */}
      <td
        className="px-4 py-3.5 font-body"
        style={{ fontSize: 13, color: "#3D3A35", fontWeight: 600 }}
      >
        ₱{Number(ingredient.cost_per_unit).toFixed(2)}
      </td>

      {/* Supplier */}
      <td className="px-4 py-3.5 font-body" style={{ fontSize: 13, color: "#9B6644" }}>
        {ingredient.supplier || <span style={{ color: "#D1CEC7" }}>—</span>}
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <StockStatusBadge status={status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <DropdownMenu
          width={190}
          trigger={({ open }) => (
            <button
              className="flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: 30,
                height: 30,
                color: "#A8A49B",
                background: open ? "#F5EDE0" : "transparent",
              }}
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
      </td>
    </tr>
  );
}
