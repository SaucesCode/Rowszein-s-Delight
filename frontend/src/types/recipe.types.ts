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
  notes: string;
  recipe_ingredients: RecipeIngredient[];
  production_cost: number;
  created_at: string;
  updated_at: string;
}

export interface RecipePayload {
  product: number;
  notes?: string;
  recipe_ingredients: {
    ingredient: number;
    quantity: number;
  }[];
}
