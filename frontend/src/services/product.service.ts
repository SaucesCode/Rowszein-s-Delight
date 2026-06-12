import api from "./api";
import type { ProductPayload } from "@/types/product.types";

const toFormData = (payload: ProductPayload): FormData => {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("description", payload.description ?? "");
  formData.append("price", String(payload.price));
  formData.append("is_available", String(payload.is_available));
  if (payload.image) {
    formData.append("image", payload.image);
  }
  return formData;
};

export const productService = {
  getAll: async (page = 1) => {
    const response = await api.get("/products/", { params: { page } });
    return response.data;
  },

  getOne: async (id: number) => {
    const response = await api.get(`/products/${id}/`);
    return response.data.data;
  },

  create: async (payload: ProductPayload) => {
    const response = await api.post("/products/", toFormData(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  update: async (id: number, payload: ProductPayload) => {
    const response = await api.put(`/products/${id}/`, toFormData(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/products/${id}/`);
    return response.data;
  },
};
