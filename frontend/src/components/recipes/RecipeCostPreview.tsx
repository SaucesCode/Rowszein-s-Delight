import type { RecipeFormInput, RecipeForm } from "@/pages/RecipeFormPage";
import { useWatch, type Control } from "react-hook-form";

interface IngredientCostLookup {
  id: number;
  cost_per_unit: number;
}

interface RecipeCostPreviewProps {
  control: Control<RecipeFormInput, unknown, RecipeForm>;
  ingredients: IngredientCostLookup[];
}

/**
 * Live-updates as ingredient rows and quantities change — same useWatch
 * pattern as SaleFormPage's OrderTotal, so the two "does this number look
 * right before I save" moments in the app behave identically.
 */
export default function RecipeCostPreview({ control, ingredients }: RecipeCostPreviewProps) {
  const rows = useWatch({ control, name: "recipe_ingredients" });
  const yieldQuantity = useWatch({ control, name: "yield_quantity" });

  const costById = new Map(ingredients.map(i => [i.id, i.cost_per_unit]));

  const batchCost =
    rows?.reduce((sum: number, row: any) => {
      const unitCost = costById.get(Number(row?.ingredient)) ?? 0;
      const qty = Number(row?.quantity) || 0;
      return sum + unitCost * qty;
    }, 0) ?? 0;

  const yieldQty = Number(yieldQuantity) || 1;
  const costPerUnit = batchCost / yieldQty;

  return (
    <div
      aria-live="polite"
      className="flex items-center justify-end gap-6 pt-3 mt-3 flex-wrap"
      style={{ borderTop: "1px solid #F5EDE0" }}
    >
      <div className="text-right">
        <p className="font-body" style={{ fontSize: 11, color: "#9B6644" }}>
          Batch Cost
        </p>
        <p className="font-heading font-semibold" style={{ fontSize: 16, color: "#6B4226" }}>
          ₱{batchCost.toFixed(2)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-body" style={{ fontSize: 11, color: "#9B6644" }}>
          Cost / Unit
        </p>
        <p className="font-heading font-semibold" style={{ fontSize: 18, color: "#FF6FAE" }}>
          ₱{costPerUnit.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
