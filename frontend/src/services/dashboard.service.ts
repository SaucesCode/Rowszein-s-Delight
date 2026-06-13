import api from "./api";

export const dashboardService = {
  get: async () => {
    const response = await api.get("/dashboard/");
    return response.data.data;
  },
};
