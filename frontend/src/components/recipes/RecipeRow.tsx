import { MoreVertical, Pencil, Trash2, BookOpen } from "lucide-react";
import type { Recipe } from "@/types/recipe.types";
import DropdownMenu from "@/components/DropdownMenu";

interface RecipeRowProps {
  recipe: Recipe;
  category?: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RecipeRow({ recipe, category, onEdit, onDelete }: RecipeRowProps) {
  const ingredientCount = recipe.recipe_ingredients.length;

  return (
    <tr
      className="table-row-hover transition-colors"
      style={{ borderBottom: "1px solid #F5EDE0" }}
    >
      {/* Product */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 34, height: 34, background: "#FFF0F7" }}
          >
            <BookOpen size={15} style={{ color: "#FF6FAE" }} aria-hidden="true" />
          </div>
          <span
            className="font-heading font-medium"
            style={{ fontSize: 13, color: "#6B4226" }}
          >
            {recipe.product_name}
          </span>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-3.5 font-body" style={{ fontSize: 13, color: "#9B6644" }}>
        {category ?? <span style={{ color: "#D1CEC7" }}>—</span>}
      </td>

      {/* Ingredient count */}
      <td className="px-4 py-3.5">
        <span className="badge badge-info" style={{ fontSize: 11 }}>
          {ingredientCount} {ingredientCount === 1 ? "ingredient" : "ingredients"}
        </span>
      </td>

      {/* Yield */}
      <td className="px-4 py-3.5 font-body" style={{ fontSize: 13, color: "#7C7870" }}>
        {recipe.yield_quantity} {recipe.yield_quantity === 1 ? "unit" : "units"}
      </td>

      {/* Batch cost */}
      <td className="px-4 py-3.5 font-body" style={{ fontSize: 13, color: "#3D3A35" }}>
        ₱{Number(recipe.production_cost).toFixed(2)}
      </td>

      {/* Cost per unit */}
      <td
        className="px-4 py-3.5 font-body"
        style={{ fontSize: 13, color: "#3D3A35", fontWeight: 600 }}
      >
        ₱{Number(recipe.cost_per_unit).toFixed(2)}
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
      </td>
    </tr>
  );
}
