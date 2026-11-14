import type { Ingredient } from "@/types/ingredient.types";
import { STOCK_STATUS_LABEL, stockStatus } from "@/lib/stockStatus";
import { downloadCSV } from "@/lib/csv";

/**
 * Ingredients don't have a backend export endpoint yet (unlike Sales/Expenses),
 * so this builds the CSV client-side from whatever rows are currently visible.
 */
export function exportIngredientsCSV(ingredients: Ingredient[]) {
  const header = [
    "Name",
    "Category",
    "Current Stock",
    "Unit",
    "Minimum Stock",
    "Cost Per Unit",
    "Supplier",
    "Status",
  ];

  const rows = ingredients.map(ingredient => [
    ingredient.name,
    ingredient.category_display ?? ingredient.category ?? "",
    ingredient.quantity,
    ingredient.unit,
    ingredient.minimum_stock,
    ingredient.cost_per_unit,
    ingredient.supplier ?? "",
    STOCK_STATUS_LABEL[stockStatus(ingredient)],
  ]);

  downloadCSV("ingredients.csv", header, rows);
}
