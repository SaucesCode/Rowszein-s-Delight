import api from "./api";
import type { Ingredient, IngredientPayload } from "@/types/ingredient.types";

const toFormData = (payload: IngredientPayload): FormData => {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("quantity", String(payload.quantity));
  formData.append("unit", payload.unit);
  formData.append("cost_per_unit", String(payload.cost_per_unit));
  formData.append("supplier", payload.supplier ?? "");
  formData.append("minimum_stock", String(payload.minimum_stock ?? 0));
  // Forward-compatible — ignored by the current serializer until the
  // backend adds columns for these, same pattern as Product's image field.
  if (payload.category) formData.append("category", payload.category);
  if (payload.notes) formData.append("notes", payload.notes);
  if (payload.image) formData.append("image", payload.image);
  return formData;
};

export const ingredientService = {
  getAll: async (page = 1) => {
    const response = await api.get("/ingredients/", { params: { page } });
    return response.data;
  },

  getOne: async (id: number) => {
    const response = await api.get(`/ingredients/${id}/`);
    return response.data.data as Ingredient;
  },

  getLowStock: async () => {
    const response = await api.get("/ingredients/low-stock/");
    return response.data.data as Ingredient[];
  },

  create: async (payload: IngredientPayload) => {
    const response = await api.post("/ingredients/", toFormData(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  update: async (id: number, payload: IngredientPayload) => {
    const response = await api.put(`/ingredients/${id}/`, toFormData(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/ingredients/${id}/`);
    return response.data;
  },
};
