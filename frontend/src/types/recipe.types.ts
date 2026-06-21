export interface RecipeIngredient {
  id?: number;
  ingredient: number;
  ingredient_name?: string;
  unit?: string;
  quantity: number;
}

export interface Recipe {
  id: number;
  product: number;
  product_name: string;
  yield_quantity: number;
  notes: string;
  recipe_ingredients: RecipeIngredient[];
  production_cost: number; // total cost for the whole batch
  cost_per_unit: number; // cost per single product unit
  created_at: string;
  updated_at: string;
}

export interface RecipePayload {
  product: number;
  yield_quantity: number;
  notes?: string;
  recipe_ingredients: {
    ingredient: number;
    quantity: number;
  }[];
}
