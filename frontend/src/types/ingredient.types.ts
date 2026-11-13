export type Unit = "kg" | "g" | "ml" | "l" | "pcs" | "tbsp" | "tsp" | "cup";

export interface Ingredient {
  id: number;
  name: string;
  quantity: number | string;
  stock_revision: string;
  unit: Unit;
  cost_per_unit: number;
  supplier: string;
  minimum_stock: number;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
  category?: string;
  category_display?: string;
  image_url?: string | null;
  notes?: string;
}

export interface IngredientPayload {
  name: string;
  quantity: string;
  unit: Unit;
  cost_per_unit: number;
  supplier?: string;
  minimum_stock?: number;
  category?: string;
  notes?: string;
  image?: File | null;
}

export interface StockAdjustment {
  type: "add" | "deduct";
  amount: number;
  note?: string;
}

/** Mirrors Ingredient.Category in backend/ingredients/models.py. */
export const INGREDIENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "flour_grains", label: "Flour & Grains" },
  { value: "dairy", label: "Dairy" },
  { value: "sweeteners", label: "Sweeteners" },
  { value: "flavorings", label: "Flavorings & Extracts" },
  { value: "packaging", label: "Packaging" },
  { value: "other", label: "Other" },
];
