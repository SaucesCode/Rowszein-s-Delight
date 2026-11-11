import api from "./api";
import type { Recipe, RecipePayload } from "@/types/recipe.types";
import type { ListingParams } from "@/lib/listingParams";
import { listingService } from "./listing.service";

export const recipeService = {
  getAll: (page = 1, params: ListingParams = {}, signal?: AbortSignal) => listingService.get<Recipe>("recipes", { ...params, page }, signal),

  getOne: async (id: number) => {
    const response = await api.get(`/recipes/${id}/`);
    return response.data.data;
  },

  create: async (payload: RecipePayload) => {
    const response = await api.post("/recipes/", payload);
    return response.data;
  },

  update: async (id: number, payload: RecipePayload) => {
    const response = await api.put(`/recipes/${id}/`, payload);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/recipes/${id}/`);
    return response.data;
  },
};
