import api from "./api";

export interface DashboardFilters {
  date_from?: string;
  date_to?: string;
}

export type PesoValue = number | `${number}`;

export interface ChartMonth {
  month: string;
  sales: number;
  expenses: number;
  profit: number;
}

export interface DashboardReport {
  filters: Required<DashboardFilters>;
  totals: { net_sales: `${number}`; total_expenses: number; net_profit: number };
  chart_data: ChartMonth[];
  best_selling: { product_id: number; product_name: string; total_quantity: number; total_revenue: number }[];
  low_stock: { id: number; name: string; quantity: string; minimum_stock: string; unit: string }[];
}

export const dashboardService = {
  get: async (filters?: DashboardFilters) => {
    const response = await api.get<{ data: DashboardReport }>("/dashboard/", { params: filters });
    return response.data.data;
  },

  getProfitMargins: async () => {
    const response = await api.get("/dashboard/profit-margins/");
    return response.data.data;
  },
};
