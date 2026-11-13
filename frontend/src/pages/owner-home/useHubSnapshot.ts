import { useMemo } from "react";
import { useLowStockIngredients } from "@/hooks/useIngredients";
import { useSales, useSalesSummary } from "@/hooks/useSales";
import { useDashboard } from "@/hooks/useDashboard";
import { getDateRange } from "@/lib/dateRanges";
import type { Ingredient } from "@/types/ingredient.types";
import type { Sale } from "@/types/sale.types";

export type Metric<T> =
  | { state: "loading" }
  | { state: "error"; retry: () => void }
  | { state: "ready"; value: T };

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

function toMetric<T>(query: QueryLike, read: () => T): Metric<T> {
  if (query.isError) return { state: "error", retry: () => void query.refetch() };
  if (query.isPending) return { state: "loading" };
  return { state: "ready", value: read() };
}

export interface BestSeller {
  name: string;
  quantity: number;
}

export interface WeekTotals {
  sold: number;
  spent: number;
  profit: number;
}

const LATEST = 5;

/** Everything Home shows, derived from existing queries. Sales come back newest first. */
export function useHubSnapshot(now: Date) {
  const todayRange = useMemo(() => getDateRange("today", now), [now]);
  const weekRange = useMemo(() => getDateRange("this_week", now), [now]);

  const lowStock = useLowStockIngredients();
  const sales = useSales(todayRange, true);
  const salesSummary = useSalesSummary(todayRange, true);
  const today = useDashboard(todayRange, true);
  const week = useDashboard(weekRange, true);

  return {
    salesToday: toMetric(salesSummary, () => Number(salesSummary.data?.totals?.net_sales ?? 0)),
    ordersToday: toMetric(sales, () => sales.data?.data?.count ?? 0),
    latestOrders: toMetric(sales, (): Sale[] => (sales.data?.data?.results ?? []).slice(0, LATEST)),
    bestSeller: toMetric(today, (): BestSeller | null => {
      const top = today.data?.best_selling?.[0];
      return top ? { name: top.product_name, quantity: Number(top.total_quantity) } : null;
    }),
    week: toMetric(week, (): WeekTotals => ({
      sold: Number(week.data?.totals?.net_sales ?? 0),
      spent: Number(week.data?.totals?.total_expenses ?? 0),
      profit: Number(week.data?.totals?.net_profit ?? 0),
    })),
    lowStock: toMetric(lowStock, (): Ingredient[] => lowStock.data ?? []),
  };
}

export type HubSnapshot = ReturnType<typeof useHubSnapshot>;
