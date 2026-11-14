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
  /** Owed to partners for their items sold that month (their price, not the patong). */
  payouts: number;
  profit: number;
}

export interface DashboardReport {
  filters: Required<DashboardFilters>;
  totals: { net_sales: `${number}`; total_expenses: number; partner_payouts: `${number}`; net_profit: number };
  chart_data: ChartMonth[];
  best_selling: { product_id: number; product_name: string; total_quantity: number; total_revenue: number }[];
  low_stock: { id: number; name: string; quantity: string; minimum_stock: string; unit: string }[];
}

/** One donut's price split, from /dashboard/profit-margins/ (every product, recipe or not). */
export interface ProductMargin {
  product_id: number;
  product_name: string;
  selling_price: number;
  production_cost: number;
  profit_per_unit: number;
  margin_percent: number;
  has_recipe: boolean;
  /** A partner's item: production_cost is their price and profit_per_unit is the patong. */
  is_partner: boolean;
  is_available: boolean;
}

export const dashboardService = {
  get: async (filters?: DashboardFilters) => {
    const response = await api.get<{ data: DashboardReport }>("/dashboard/", { params: filters });
    return response.data.data;
  },

  getProfitMargins: async (): Promise<ProductMargin[]> => {
    const response = await api.get("/dashboard/profit-margins/");
    return response.data.data;
  },
};
