import type { Category, Product } from "@/types/product.types";

export interface Shelf {
  category: Pick<Category, "id" | "name">;
  items: Product[];
}

/** Groups donuts onto one shelf per category, in the shop's category order. */
export function toShelves(products: Product[], categories: Category[]): Shelf[] {
  const order = new Map(categories.map(category => [category.id, category.sort_order]));
  const shelves = new Map<number, Shelf>();
  for (const product of products) {
    const shelf = shelves.get(product.category.id) ?? { category: product.category, items: [] };
    shelf.items.push(product);
    shelves.set(product.category.id, shelf);
  }
  return [...shelves.values()].sort(
    (a, b) =>
      (order.get(a.category.id) ?? 999) - (order.get(b.category.id) ?? 999) ||
      a.category.name.localeCompare(b.category.name),
  );
}
