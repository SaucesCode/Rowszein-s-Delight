import { useProducts } from "@/hooks/useProducts";
import type { Category, Product } from "@/types/product.types";

export type MenuView = "menu" | "resting" | "all";

export const MENU_VIEWS: { value: MenuView; label: string }[] = [
  { value: "menu", label: "On the menu" },
  { value: "resting", label: "Resting" },
  { value: "all", label: "Everything" },
];

export const MENU_AVAILABILITY: Record<MenuView, boolean | undefined> = { menu: true, resting: false, all: undefined };

/** Collection-wide counts for the view switcher, independent of search. */
export function useMenuCounts() {
  const all = useProducts(1, { page_size: 1 });
  const menu = useProducts(1, { page_size: 1, is_available: true });
  if (!all.data || !menu.data) return null;
  const total = all.data.data.count;
  const onMenu = menu.data.data.count;
  return { all: total, menu: onMenu, resting: total - onMenu };
}

/** Groups one page of donuts under their categories, in the shop's category order. */
export function groupByCategory(products: Product[], categories: Category[]) {
  const order = new Map(categories.map(category => [category.id, category.sort_order]));
  const groups = new Map<number, { category: Category; items: Product[] }>();
  for (const product of products) {
    const group = groups.get(product.category.id) ?? { category: product.category, items: [] };
    group.items.push(product);
    groups.set(product.category.id, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      (order.get(a.category.id) ?? 999) - (order.get(b.category.id) ?? 999) ||
      a.category.name.localeCompare(b.category.name),
  );
}
