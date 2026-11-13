import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Donut,
  Receipt,
  TrendingUp,
  Wallet,
  Wheat,
} from "lucide-react";

export interface OwnerSection {
  to: string;
  title: string;
  icon: LucideIcon;
  capability: string;
  newLabel?: string;
  editLabel?: string;
}

/**
 * The six owner sections, ordered by how often the counter uses them.
 * Drives the sidebar, the hub's "Around the shop" list and the back link.
 */
export const OWNER_SECTIONS: OwnerSection[] = [
  {
    to: "/sales",
    title: "Sales register",
    icon: Receipt,
    capability: "sales.read",
    newLabel: "New sale",
    editLabel: "Edit sale",
  },
  {
    to: "/ingredients",
    title: "Pantry",
    icon: Wheat,
    capability: "stock.read",
    newLabel: "New ingredient",
    editLabel: "Edit ingredient",
  },
  {
    to: "/products",
    title: "Donut collection",
    icon: Donut,
    capability: "catalog.read",
    newLabel: "New donut",
    editLabel: "Edit donut",
  },
  {
    to: "/recipes",
    title: "Recipe costing",
    icon: BookOpen,
    capability: "recipes.manage",
    newLabel: "New recipe",
    editLabel: "Edit recipe",
  },
  {
    to: "/expenses",
    title: "Shop expenses",
    icon: Wallet,
    capability: "expenses.manage",
    newLabel: "New expense",
    editLabel: "Edit expense",
  },
  {
    to: "/analytics",
    title: "Profit & analytics",
    icon: TrendingUp,
    capability: "finance.read",
  },
];

export interface Crumb {
  to: string;
  label: string;
}

/** Section trail for a pathname, e.g. Donut collection › New donut. */
export function ownerTrail(pathname: string): Crumb[] {
  const section = OWNER_SECTIONS.find(
    item => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  if (!section) return [];

  const trail: Crumb[] = [{ to: section.to, label: section.title }];
  const rest = pathname.slice(section.to.length).replace(/\/$/, "");
  // Boxes live under the Donut collection: /products/boxes, /products/boxes/new, /products/boxes/:id/edit.
  if (section.to === "/products" && /^\/boxes(\/|$)/.test(rest)) {
    trail.push({ to: "/products/boxes", label: "Boxes" });
    const boxRest = rest.slice("/boxes".length);
    if (boxRest === "/new") trail.push({ to: pathname, label: "New ready-made box" });
    if (/^\/\d+\/edit$/.test(boxRest)) trail.push({ to: pathname, label: "Edit ready-made box" });
    return trail;
  }
  if (rest === "/new" && section.newLabel) trail.push({ to: pathname, label: section.newLabel });
  if (/^\/\d+\/edit$/.test(rest) && section.editLabel) trail.push({ to: pathname, label: section.editLabel });
  return trail;
}
