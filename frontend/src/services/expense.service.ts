import api from "./api";
import type{ ExpensePayload } from "@/types/expense.types";

export interface ExpenseFilters {
  page?: number;
  date_from?: string;
  date_to?: string;
}

export const expenseService = {
  getAll: async (filters: ExpenseFilters = {}) => {
    const response = await api.get("/expenses/", { params: filters });
    return response.data;
  },

  getOne: async (id: number) => {
    const response = await api.get(`/expenses/${id}/`);
    return response.data.data;
  },

  create: async (payload: ExpensePayload) => {
    const response = await api.post("/expenses/", payload);
    return response.data;
  },

  update: async (id: number, payload: ExpensePayload) => {
    const response = await api.put(`/expenses/${id}/`, payload);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/expenses/${id}/`);
    return response.data;
  },
};
