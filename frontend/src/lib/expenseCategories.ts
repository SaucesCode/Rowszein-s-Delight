import type { LucideIcon } from "lucide-react";
import { Ellipsis, Package, Truck, Wheat, Zap } from "lucide-react";
import type { ExpenseCategory } from "@/types/expense.types";

export interface CategoryInfo {
  value: ExpenseCategory;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Soft fill for bars and icon chips; never used for text. */
  color: string;
}

/** Mirrors Expense.Category on the backend, in the order Rose most often pays them. */
export const EXPENSE_CATEGORIES: CategoryInfo[] = [
  { value: "ingredient", label: "Ingredients", hint: "Flour, sugar, fillings bought for baking", icon: Wheat, color: "var(--color-warn-soft)" },
  { value: "packaging", label: "Packaging", hint: "Boxes, bags, labels, ribbons", icon: Package, color: "var(--color-glaze-strawberry)" },
  { value: "utilities", label: "Utilities", hint: "Electricity, water, gas, internet", icon: Zap, color: "var(--color-glaze-ube)" },
  { value: "transportation", label: "Transport", hint: "Deliveries, fuel, trips to suppliers", icon: Truck, color: "var(--color-glaze-matcha)" },
  { value: "other", label: "Other", hint: "Anything else the shop paid for", icon: Ellipsis, color: "var(--color-ink-faint)" },
];

export const categoryInfo = (value: string): CategoryInfo =>
  EXPENSE_CATEGORIES.find(category => category.value === value) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
