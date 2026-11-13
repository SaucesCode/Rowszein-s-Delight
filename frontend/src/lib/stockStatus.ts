import type { Ingredient, Unit } from "@/types/ingredient.types";

export type StockStatus = "out" | "low" | "stocked";

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  out: "Out of stock",
  low: "Running low",
  stocked: "Stocked",
};

/** Same rule as the backend's status filter: nothing left, at/below the restock level, or fine. */
export function stockStatus(ingredient: Pick<Ingredient, "quantity" | "is_low_stock">): StockStatus {
  if (Number(ingredient.quantity) <= 0) return "out";
  return ingredient.is_low_stock ? "low" : "stocked";
}

/**
 * Fill and restock-mark positions (0–1) for level gauges. The scale is at least
 * 2.5× the restock level, so a well-stocked shelf reads as comfortably full and
 * the restock line always sits low enough to notice.
 */
export function stockLevel(quantity: number, minimum: number): { fill: number; mark: number | null } {
  const full = Math.max(quantity, minimum * 2.5, 1);
  return {
    fill: Math.min(Math.max(quantity / full, 0), 1),
    mark: minimum > 0 ? minimum / full : null,
  };
}

const UNIT_LABEL: Record<Unit, string> = {
  kg: "kg",
  g: "g",
  l: "L",
  ml: "ml",
  pcs: "pcs",
  tbsp: "tbsp",
  tsp: "tsp",
  cup: "cups",
};

export const unitLabel = (unit: Unit) => UNIT_LABEL[unit] ?? unit;

/** Readable amount, e.g. "1,250 g" or "0.45 L". Display only; never feed back into requests. */
export function formatAmount(value: number | string, unit: Unit): string {
  const number = Number(value).toLocaleString("en-PH", { maximumFractionDigits: 3 });
  return `${number} ${unitLabel(unit)}`;
}

/** Sensible − / + step per unit: grams and millilitres move in hundreds. */
export const unitStep = (unit: Unit) => (unit === "g" || unit === "ml" ? 100 : 1);
