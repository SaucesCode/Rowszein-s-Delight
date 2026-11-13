import { PackagePlus, Trash2 } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";
import StockStatusBadge, { resolveStockStatus } from "./StockStatusBadge";

interface IngredientRowProps {
  ingredient: Ingredient;
  onEdit: () => void;
  onUpdateStock: () => void;
  onDelete: () => void;
}

function getCategoryColor(category: string = "") {
  const cat = category.toLowerCase();
  if (cat.includes("flour") || cat.includes("grain")) return { text: "#9A6700", bg: "#FFF3DC" };
  if (cat.includes("dairy")) return { text: "#854D0E", bg: "#FEF9C3" };
  if (cat.includes("sweetener") || cat.includes("sugar")) return { text: "#78350F", bg: "#F5E6D8" };
  if (cat.includes("flavor") || cat.includes("extract")) return { text: "#C7255E", bg: "#FFE6F0" };
  if (cat.includes("pack")) return { text: "#57534E", bg: "#EDE9DE" };
  return { text: "#C7255E", bg: "#FFE6F0" };
}

export default function IngredientRow({
  ingredient,
  onEdit,
  onUpdateStock,
  onDelete,
}: IngredientRowProps) {
  const status = resolveStockStatus(ingredient);
  const isLow = status === "low_stock" || status === "out_of_stock";
  const qty = Number(ingredient.quantity);
  const minStock = Number(ingredient.minimum_stock);
  const cost = Number(ingredient.cost_per_unit);
  const totalValue = qty * cost;
  const catStyle = getCategoryColor(ingredient.category);

  return (
    <tr className="hover:bg-[#FFFDFE] transition-colors" style={{ borderBottom: "1px solid #F8EBF1" }}>
      {/* ─── 1. Name & Supplier ─── */}
      <td className="px-5 py-4">
        <div>
          <strong className="block text-sm font-bold" style={{ color: "#2B1820" }}>
            {ingredient.name}
          </strong>
          <span className="block text-xs text-gray-400 mt-0.5">
            {ingredient.supplier || "Bakery Supplier"}
          </span>
        </div>
      </td>

      {/* ─── 2. Category ─── */}
      <td className="px-5 py-4">
        <span
          className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: catStyle.bg, color: catStyle.text }}
        >
          {ingredient.category || "General"}
        </span>
      </td>

      {/* ─── 3. Current Stock ─── */}
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1">
            <span
              className="text-sm font-extrabold"
              style={{ color: isLow ? "#C7255E" : "#2B1820" }}
            >
              {qty.toLocaleString("en-PH", { maximumFractionDigits: 3 })}
            </span>
            <span className="text-xs text-gray-500 font-semibold">{ingredient.unit}</span>
          </div>
          {/* Progress bar */}
          <div className="w-24 h-1.5 rounded-full overflow-hidden bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(5, (qty / Math.max(minStock * 2, qty, 1)) * 100))}%`,
                background: isLow ? "#C7255E" : "#10B981",
              }}
            />
          </div>
        </div>
      </td>

      {/* ─── 4. Min Reorder Threshold ─── */}
      <td className="px-5 py-4 text-xs font-semibold text-gray-500">
        {minStock.toLocaleString("en-PH")} {ingredient.unit}
      </td>

      {/* ─── 5. Cost Per Unit ─── */}
      <td className="px-5 py-4 text-sm font-bold" style={{ color: "#C7255E" }}>
        ₱{cost.toFixed(2)}
      </td>

      {/* ─── 6. Total Valuation ─── */}
      <td className="px-5 py-4 text-sm font-extrabold" style={{ color: "#2B1820" }}>
        ₱{totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>

      {/* ─── 7. Status Badge ─── */}
      <td className="px-5 py-4">
        <StockStatusBadge status={status} />
      </td>

      {/* ─── 8. Actions ─── */}
      <td className="px-5 py-4 text-right">
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUpdateStock}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border-none"
            style={{
              background: isLow ? "#C7255E" : "#FFE6F0",
              color: isLow ? "#FFFFFF" : "#C7255E",
            }}
          >
            <PackagePlus size={12} strokeWidth={2.5} />
            <span>{isLow ? "Restock" : "Adjust"}</span>
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer border-none"
            style={{ background: "#F8EBF1", color: "#7E6570" }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#F3DCE5";
              e.currentTarget.style.color = "#2B1820";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#F8EBF1";
              e.currentTarget.style.color = "#7E6570";
            }}
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer border-none text-red-500 hover:bg-red-50"
            aria-label={`Delete ${ingredient.name}`}
          >
            <Trash2 size={13} strokeWidth={2.2} />
          </button>
        </div>
      </td>
    </tr>
  );
}
