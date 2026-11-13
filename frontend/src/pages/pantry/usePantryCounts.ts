import { useIngredients } from "@/hooks/useIngredients";

/** Pantry-wide counts per stock status, independent of any search or filter. */
export function usePantryCounts() {
  const all = useIngredients(1, { page_size: 1 });
  const low = useIngredients(1, { page_size: 1, status: "low_stock" });
  const out = useIngredients(1, { page_size: 1, status: "out_of_stock" });
  const stocked = useIngredients(1, { page_size: 1, status: "healthy" });
  const queries = [all, low, out, stocked];
  if (queries.some(query => !query.data)) return null;
  const count = (query: typeof all) => query.data?.data?.count ?? 0;
  return { all: count(all), low_stock: count(low), out_of_stock: count(out), healthy: count(stocked) };
}
