import type { Ingredient } from "@/types/ingredient.types";
import { resolveStockStatus } from "@/components/ingredients/StockStatusBadge";

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};

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
    ingredient.category ?? "",
    ingredient.quantity,
    ingredient.unit,
    ingredient.minimum_stock,
    ingredient.cost_per_unit,
    ingredient.supplier ?? "",
    STATUS_LABEL[resolveStockStatus(ingredient)],
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ingredients.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}
