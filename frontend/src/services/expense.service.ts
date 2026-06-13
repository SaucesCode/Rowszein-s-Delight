import api from "./api";
import type { ExpensePayload } from "@/types/expense.types";

export const expenseService = {
  getAll: async (page = 1) => {
    const response = await api.get("/expenses/", { params: { page } });
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
