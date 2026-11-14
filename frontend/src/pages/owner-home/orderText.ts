import type { Sale } from "@/types/sale.types";

/** "Box of 12, 2× Glazed Original": what an order was, for the Home feed. */
export function orderItemsText(sale: Pick<Sale, "sale_items" | "boxes">): string {
  const boxes = (sale.boxes ?? []).map(box => box.name);
  const singles = sale.sale_items.map(item => `${item.quantity}× ${item.product_name ?? "Donut"}`);
  return [...boxes, ...singles].join(", ");
}
