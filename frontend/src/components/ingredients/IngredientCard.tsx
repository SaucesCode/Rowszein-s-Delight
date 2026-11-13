import { MoreVertical, Pencil, PackagePlus, Trash2 } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";
import StockStatusBadge, { resolveStockStatus } from "./StockStatusBadge";
import DropdownMenu from "@/components/DropdownMenu";

interface IngredientCardProps {
  ingredient: Ingredient;
  onEdit: () => void;
  onUpdateStock: () => void;
  onDelete: () => void;
}

function getCategoryTheme(category: string = "") {
  const cat = category.toLowerCase();
  if (cat.includes("flour") || cat.includes("grain")) {
    return {
      label: "Flour & Grains",
      bg: "linear-gradient(135deg, #FFF6E6 0%, #FFE9CC 100%)",
      color: "#9A6700",
      pillBg: "#FFF3DC",
    };
  }
  if (cat.includes("dairy") || cat.includes("milk") || cat.includes("butter")) {
    return {
      label: "Dairy",
      bg: "linear-gradient(135deg, #FFFDEB 0%, #FEF9C3 100%)",
      color: "#854D0E",
      pillBg: "#FEF9C3",
    };
  }
  if (cat.includes("sweetener") || cat.includes("sugar") || cat.includes("choco")) {
    return {
      label: "Sweeteners & Cocoa",
      bg: "linear-gradient(135deg, #FDF4EB 0%, #F5E6D8 100%)",
      color: "#78350F",
      pillBg: "#F5E6D8",
    };
  }
  if (cat.includes("flavor") || cat.includes("extract")) {
    return {
      label: "Flavors & Extracts",
      bg: "linear-gradient(135deg, #FFF0F5 0%, #FFE6F0 100%)",
      color: "#C7255E",
      pillBg: "#FFE6F0",
    };
  }
  if (cat.includes("pack")) {
    return {
      label: "Packaging",
      bg: "linear-gradient(135deg, #F7F5F0 0%, #EDE9DE 100%)",
      color: "#57534E",
      pillBg: "#EDE9DE",
    };
  }
  return {
    label: "Baking Supplies",
    bg: "linear-gradient(135deg, #FFF0F5 0%, #FFE6F0 100%)",
    color: "#C7255E",
    pillBg: "#FFE6F0",
  };
}

export default function IngredientCard({
  ingredient,
  onEdit,
  onUpdateStock,
  onDelete,
}: IngredientCardProps) {
  const status = resolveStockStatus(ingredient);
  const theme = getCategoryTheme(ingredient.category);
  const qty = Number(ingredient.quantity);
  const minStock = Number(ingredient.minimum_stock);
  const cost = Number(ingredient.cost_per_unit);
  const totalValue = qty * cost;

  // Calculate stock fill percent relative to 2.5x minimum stock (or minimum + margin)
  const maxBenchmark = Math.max(minStock * 2, qty * 1.2, 1);
  const fillPercent = Math.min(100, Math.max(5, (qty / maxBenchmark) * 100));

  const isLow = status === "low_stock" || status === "out_of_stock";

  return (
    <article
      className="group/card flex flex-col bg-white transition-all duration-200"
      style={{
        border: isLow ? "1.5px solid #F5CADB" : "1px solid var(--ol-card-border, #F5D5E2)",
        borderRadius: "16px",
        boxShadow: isLow
          ? "0 2px 8px rgba(199, 37, 94, 0.08)"
          : "0 1px 3px rgba(43, 24, 32, 0.04), 0 2px 6px rgba(199, 37, 94, 0.03)",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = "var(--ol-card-border-hover, #EEB3CB)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(199, 37, 94, 0.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = isLow ? "#F5CADB" : "var(--ol-card-border, #F5D5E2)";
        e.currentTarget.style.boxShadow = isLow
          ? "0 2px 8px rgba(199, 37, 94, 0.08)"
          : "0 1px 3px rgba(43, 24, 32, 0.04), 0 2px 6px rgba(199, 37, 94, 0.03)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      aria-label={`${ingredient.name}, ${theme.label}, Stock: ${qty} ${ingredient.unit}`}
    >
      {/* ─── Top Banner with Category & Status ─── */}
      <div
        className="px-4 py-3 flex items-center justify-between rounded-t-[15px]"
        style={{ background: theme.bg }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: theme.color, letterSpacing: "0.05em" }}
        >
          {theme.label}
        </span>
        <StockStatusBadge status={status} />
      </div>

      {/* ─── Card Body ─── */}
      <div className="p-4 flex flex-col flex-1">
        <h3
          className="font-bold text-base truncate mb-0.5"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: "#2B1820",
            letterSpacing: "-0.015em",
          }}
          title={ingredient.name}
        >
          {ingredient.name}
        </h3>
        <span className="text-xs text-gray-400 truncate mb-3">
          {ingredient.supplier || "Standard Bakery Supplier"}
        </span>

        {/* ─── Stock Quantity Display Box ─── */}
        <div
          className="p-3.5 rounded-xl mb-3"
          style={{
            background: isLow ? "#FFF7FA" : "#FFFDFE",
            border: isLow ? "1px solid #FCD4E3" : "1px solid #F5EBF0",
          }}
        >
          <div className="flex items-baseline justify-between mb-1.5">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: isLow ? "#C7255E" : "#7E6570" }}
            >
              Current Quantity
            </span>
            <span className="text-xs text-gray-400">
              Min Reorder: {minStock.toLocaleString("en-PH")} {ingredient.unit}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span
              className="text-2xl font-extrabold"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: isLow ? "#C7255E" : "#2B1820",
                letterSpacing: "-0.02em",
              }}
            >
              {qty.toLocaleString("en-PH", { maximumFractionDigits: 3 })}
            </span>
            <span className="text-sm font-semibold" style={{ color: isLow ? "#C7255E" : "#7E6570" }}>
              {ingredient.unit}
            </span>
          </div>

          {/* Visual Stock Meter */}
          <div className="w-full h-1.5 rounded-full overflow-hidden mt-2.5 bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${fillPercent}%`,
                background: isLow ? "#C7255E" : "#10B981",
              }}
            />
          </div>
        </div>

        {/* ─── Financial Value Row ─── */}
        <div
          className="flex items-center justify-between pt-2 mt-auto text-xs"
          style={{ borderTop: "1px solid #FDF0F5", color: "#7E6570" }}
        >
          <span>₱{cost.toFixed(2)} / {ingredient.unit}</span>
          <span className="font-bold" style={{ color: "#2B1820" }}>
            Total ₱{totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* ─── Card Footer: Adjust Stock + Actions ─── */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2 rounded-b-[15px] relative"
        style={{ background: "#FFFDFE", borderTop: "1px solid #F8EBF1" }}
      >
        <button
          type="button"
          onClick={onUpdateStock}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border-none"
          style={{
            background: isLow ? "#C7255E" : "#FFE6F0",
            color: isLow ? "#FFFFFF" : "#C7255E",
            boxShadow: isLow ? "0 2px 6px rgba(199, 37, 94, 0.25)" : "none",
          }}
          onMouseOver={(e) => {
            if (!isLow) {
              e.currentTarget.style.background = "#C7255E";
              e.currentTarget.style.color = "#FFFFFF";
            }
          }}
          onMouseOut={(e) => {
            if (!isLow) {
              e.currentTarget.style.background = "#FFE6F0";
              e.currentTarget.style.color = "#C7255E";
            }
          }}
        >
          <PackagePlus size={13} strokeWidth={2.5} />
          <span>{isLow ? "Restock Now" : "Adjust Stock"}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer border-none"
            style={{
              background: "#F8EBF1",
              color: "#7E6570",
            }}
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

          <DropdownMenu
            width={170}
            placement="top"
            zIndex={60}
            trigger={({ open }) => (
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer border-none"
                style={{
                  background: open ? "#FFE6F0" : "transparent",
                  color: open ? "#C7255E" : "#7E6570",
                }}
                aria-label={`Actions for ${ingredient.name}`}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <MoreVertical size={14} aria-hidden="true" />
              </button>
            )}
          >
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF0F5] cursor-pointer border-none bg-transparent"
              style={{ fontSize: 13, color: "#2B1820" }}
            >
              <Pencil size={14} style={{ color: "#C7255E" }} aria-hidden="true" />
              Edit Details
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FEF2F2] cursor-pointer border-none bg-transparent"
              style={{ fontSize: 13, color: "#DC2626", borderTop: "1px solid #F8EBF1" }}
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              Delete Ingredient
            </button>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
