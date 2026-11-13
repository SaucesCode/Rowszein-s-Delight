import api from "./api";
import type { Assortment, AssortmentPayload, BoxSize, BoxSizePayload, ShopBoxes } from "@/types/box.types";

export const boxService = {
  sizes: async (): Promise<BoxSize[]> => (await api.get("/products/box-sizes/")).data.data,
  createSize: async (payload: BoxSizePayload): Promise<BoxSize> => (await api.post("/products/box-sizes/", payload)).data.data,
  updateSize: async (id: number, payload: BoxSizePayload): Promise<BoxSize> =>
    (await api.patch(`/products/box-sizes/${id}/`, payload)).data.data,
  deleteSize: async (id: number) => (await api.delete(`/products/box-sizes/${id}/`)).data,

  assortments: async (): Promise<Assortment[]> => (await api.get("/products/assortments/")).data.data,
  assortment: async (id: number): Promise<Assortment> => (await api.get(`/products/assortments/${id}/`)).data.data,
  createAssortment: async (payload: AssortmentPayload): Promise<Assortment> =>
    (await api.post("/products/assortments/", payload)).data.data,
  updateAssortment: async (id: number, payload: AssortmentPayload): Promise<Assortment> =>
    (await api.put(`/products/assortments/${id}/`, payload)).data.data,
  deleteAssortment: async (id: number) => (await api.delete(`/products/assortments/${id}/`)).data,

  /** Public, signed-out view used by the online shop. */
  shop: async (signal?: AbortSignal): Promise<ShopBoxes> => {
    const response = await fetch("/api/products/boxes/", { credentials: "omit", redirect: "error", signal });
    if (!response.ok) throw new Error("Unable to load the boxes.");
    return (await response.json()).data;
  },
};
