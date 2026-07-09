export type Unit = "kg" | "g" | "ml" | "l" | "pcs" | "tbsp" | "tsp" | "cup";

export interface Ingredient {
  id: number;
  name: string;
  quantity: number;
  unit: Unit;
  cost_per_unit: number;
  supplier: string;
  minimum_stock: number;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
  /**
   * Forward-compatible fields — not yet returned/persisted by the API.
   * Editable in the form so the UI is ready the moment the backend adds
   * columns for them; until then they simply won't survive a refresh.
   */
  category?: string;
  image_url?: string | null;
  notes?: string;
}

export interface IngredientPayload {
  name: string;
  quantity: number;
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

/** Client-side ingredient category list — swap for API data once the
 *  backend exposes ingredient categories (mirrors products' Category model). */
export const INGREDIENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "flour_grains", label: "Flour & Grains" },
  { value: "dairy", label: "Dairy" },
  { value: "sweeteners", label: "Sweeteners" },
  { value: "flavorings", label: "Flavorings & Extracts" },
  { value: "packaging", label: "Packaging" },
  { value: "other", label: "Other" },
];
