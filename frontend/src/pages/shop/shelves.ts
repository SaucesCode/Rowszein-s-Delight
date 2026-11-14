import type { Category, Product } from "@/types/product.types";
import { canGoInBox } from "./useBoxOrder.ts";

export interface Shelf {
  id: string;
  title: string;
  /** The partner's line for a partner's shelf. */
  blurb?: string;
  partner: boolean;
  items: Product[];
}

/**
 * Rowszein's donuts on one shelf per category, in the shop's category order,
 * then one "From our friends" shelf per collab partner, in partner order.
 */
export function toShelves(products: Product[], categories: Category[]): Shelf[] {
  const order = new Map(categories.map(category => [category.id, category.sort_order]));
  const own = new Map<number, { shelf: Shelf; sort: number }>();
  const partners = new Map<number, { shelf: Shelf; sort: number }>();
  for (const product of products) {
    if (product.partner) {
      const { id, name, blurb, sort_order } = product.partner;
      const entry = partners.get(id) ?? {
        shelf: { id: `partner-${id}`, title: `From our friends · ${name}`, blurb: blurb || undefined, partner: true, items: [] },
        sort: sort_order,
      };
      entry.shelf.items.push(product);
      partners.set(id, entry);
    } else {
      const { id, name } = product.category;
      const entry = own.get(id) ?? { shelf: { id: `category-${id}`, title: name, partner: false, items: [] }, sort: order.get(id) ?? 999 };
      entry.shelf.items.push(product);
      own.set(id, entry);
    }
  }
  const sorted = (entries: Map<number, { shelf: Shelf; sort: number }>) =>
    [...entries.values()].sort((a, b) => a.sort - b.sort || a.shelf.title.localeCompare(b.shelf.title)).map(entry => entry.shelf);
  return [...sorted(own), ...sorted(partners)];
}

/** Donuts for the open box drawn up top: best sellers when there are any, never a partner's item. */
export function heroPicks(featured: Product[], products: Product[], filtered: boolean): Product[] {
  const featuredDonuts = featured.filter(canGoInBox);
  if (featuredDonuts.length > 0) return featuredDonuts;
  return filtered ? [] : products.filter(canGoInBox);
}
