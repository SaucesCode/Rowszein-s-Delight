import api from "./api";
import type { Ingredient, IngredientPayload } from "@/types/ingredient.types";

export const ingredientService = {
  getAll: async (page = 1) => {
    const response = await api.get("/ingredients/", { params: { page } });
    return response.data;
  },

  getOne: async (id: number) => {
    const response = await api.get(`/ingredients/${id}/`);
    return response.data.data as Ingredient;
  },

  create: async (payload: IngredientPayload) => {
    const response = await api.post("/ingredients/", payload);
    return response.data;
  },

  update: async (id: number, payload: IngredientPayload) => {
    const response = await api.put(`/ingredients/${id}/`, payload);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/ingredients/${id}/`);
    return response.data;
  },
};
