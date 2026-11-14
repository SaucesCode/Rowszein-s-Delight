import api from "./api";
import type { ProductPayload } from "@/types/product.types";
import type { Product } from "@/types/product.types";
import type { ListingParams } from "@/lib/listingParams";
import { listingService } from "./listing.service";

const toFormData = (payload: ProductPayload): FormData => {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("description", payload.description ?? "");
  formData.append("price", String(payload.price));
  formData.append("category_id", String(payload.category_id));
  formData.append("is_available", String(payload.is_available));
  formData.append("is_featured", String(payload.is_featured));
  if (payload.box_extra !== undefined) formData.append("box_extra", String(payload.box_extra));
  // An empty partner_id means "made by Rowszein's Delight".
  if (payload.partner_id !== undefined) formData.append("partner_id", payload.partner_id === null ? "" : String(payload.partner_id));
  if (payload.partner_payout !== undefined) formData.append("partner_payout", String(payload.partner_payout));
  if (payload.image) {
    formData.append("image", payload.image);
  }
  return formData;
};

export const productService = {
  getCategories: async () => {
    const response = await api.get("/products/categories/");
    const payload = response.data;
    return {
      ...payload,
      data: Array.isArray(payload.data) ? payload.data : (payload.data?.results ?? []),
    };
  },

  getAll: (page = 1, params: ListingParams = {}, signal?: AbortSignal) => listingService.get<Product>("products", { ...params, page }, signal),

  getFeatured: async () => {
    const response = await api.get("/products/", { params: { is_featured: true, page: 1 } });
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
