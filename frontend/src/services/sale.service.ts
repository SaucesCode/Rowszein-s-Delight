import api from "./api";
import type { SalePayload } from "@/types/sale.types";

export interface SaleFilters {
  page?: number;
  date_from?: string;
  date_to?: string;
}

export const saleService = {
  getAll: async (filters: SaleFilters = {}) => {
    const response = await api.get("/sales/", { params: filters });
    return response.data;
  },

  getOne: async (id: number) => {
    const response = await api.get(`/sales/${id}/`);
    return response.data.data;
  },

  create: async (payload: SalePayload, key: string) => {
    const response = await api.post("/sales/", payload, { headers: { "Idempotency-Key": key } });
    return response.data;
  },

  update: async (id: number, payload: SalePayload, key: string, revision: string) => {
    const response = await api.put(`/sales/${id}/`, payload, { headers: { "Idempotency-Key": key, "If-Match": `"${revision}"` } });
    return response.data;
  },

  delete: async (id: number, reason: string, key: string, revision: string) => {
    const response = await api.delete(`/sales/${id}/`, { data: { reason }, headers: { "Idempotency-Key": key, "If-Match": `"${revision}"` } });
    return response.data;
  },
  financialSummary: async (filters: SaleFilters = {}) => {
    const response = await api.get("/sales/financial-summary/", { params: filters });
    return response.data.data;
  },
};
