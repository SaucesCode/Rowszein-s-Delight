import { BookOpen, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { Recipe } from "@/types/recipe.types";
import DropdownMenu from "@/components/DropdownMenu";

interface RecipeCardProps {
  recipe: Recipe;
  category?: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RecipeCard({ recipe, category, onEdit, onDelete }: RecipeCardProps) {
  const ingredientCount = recipe.recipe_ingredients.length;

  return (
    <div
      className="flex items-start gap-3 p-4"
      style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 12 }}
    >
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 40, height: 40, background: "#FFF0F7" }}
      >
        <BookOpen size={17} style={{ color: "#FF6FAE" }} aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="font-heading font-semibold truncate"
              style={{ fontSize: 14, color: "#6B4226" }}
            >
              {recipe.product_name}
            </p>
            <p className="font-body" style={{ fontSize: 12, color: "#9B6644" }}>
              {category ?? "Uncategorized"}
            </p>
          </div>

          <DropdownMenu
            width={190}
            trigger={({ open }) => (
              <button
                className="flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
                style={{
                  width: 28,
                  height: 28,
                  color: "#A8A49B",
                  background: open ? "#F5EDE0" : "transparent",
                }}
                aria-label={`Actions for ${recipe.product_name} recipe`}
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
              style={{
                fontSize: 10.5,
                color: "#B8A98D",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Ingredients
            </p>
            <p className="font-body font-semibold" style={{ fontSize: 13, color: "#3D3A35" }}>
              {ingredientCount}
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
              Yield
            </p>
            <p className="font-body font-semibold" style={{ fontSize: 13, color: "#3D3A35" }}>
              {recipe.yield_quantity} {recipe.yield_quantity === 1 ? "unit" : "units"}
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
              Batch Cost
            </p>
            <p className="font-body font-semibold" style={{ fontSize: 13, color: "#3D3A35" }}>
              ₱{Number(recipe.production_cost).toFixed(2)}
            </p>
          </div>
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
              Cost / Unit
            </p>
            <p
              className="font-heading font-semibold text-right"
              style={{ fontSize: 14, color: "#FF6FAE" }}
            >
              ₱{Number(recipe.cost_per_unit).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
