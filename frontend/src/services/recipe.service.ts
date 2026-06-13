import api from "./api";
import type { RecipePayload } from "@/types/recipe.types";

export const recipeService = {
  getAll: async (page = 1) => {
    const response = await api.get("/recipes/", { params: { page } });
    return response.data;
  },

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
