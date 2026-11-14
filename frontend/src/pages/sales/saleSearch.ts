import type { Sale } from "@/types/sale.types";

/** Sale history search: notes, single items, box names, and the donuts inside boxes. */
export function saleMatchesSearch(sale: Pick<Sale, "notes" | "sale_items" | "boxes">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const has = (text?: string | null) => !!text?.toLowerCase().includes(q);
  return (
    has(sale.notes) ||
    sale.sale_items.some(item => has(item.product_name)) ||
    (sale.boxes ?? []).some(box => has(box.name) || box.contents.some(content => has(content.product_name)))
  );
}
