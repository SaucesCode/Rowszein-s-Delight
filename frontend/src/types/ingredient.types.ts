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
}

export interface IngredientPayload {
  name: string;
  quantity: number;
  unit: Unit;
  cost_per_unit: number;
  supplier?: string;
  minimum_stock?: number;
}
