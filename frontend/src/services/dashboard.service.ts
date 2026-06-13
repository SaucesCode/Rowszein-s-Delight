import api from "./api";

export interface DashboardFilters {
  date_from?: string;
  date_to?: string;
}

export const dashboardService = {
  get: async (filters?: DashboardFilters) => {
    const response = await api.get("/dashboard/", { params: filters });
    return response.data.data;
  },

  getProfitMargins: async () => {
    const response = await api.get("/dashboard/profit-margins/");
    return response.data.data;
  },
};
