import type { LucideIcon } from "lucide-react";
import {
  Store,
  LayoutDashboard,
  Package,
  CakeSlice,
  BookOpen,
  Donut,
  Receipt,
  ShoppingCart,
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
  if (rest === "/new" && section.newLabel) trail.push({ to: pathname, label: section.newLabel });
  if (/^\/\d+\/edit$/.test(rest) && section.editLabel) trail.push({ to: pathname, label: section.editLabel });
  return trail;
}

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Omit for the top-level group (Dashboard) which needs no caption. */
  label?: string;
  items: NavItem[];
}

/**
 * Single source of truth for the Owner Panel's navigation.
 * Grouped by how the owner actually thinks about the business —
 * not a flat alphabetical list — so the sidebar reads as a mental
 * model instead of a menu dump.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/home", label: "Control Hub", icon: Store },
      { to: "/analytics", label: "Analytics", icon: LayoutDashboard },
      { to: "/sales", label: "Sales", icon: ShoppingCart },
    ],
  },
  {
    label: "Bakery",
    items: [
      { to: "/ingredients", label: "Ingredients", icon: Package },
      { to: "/products", label: "Products", icon: CakeSlice },
      { to: "/recipes", label: "Recipes", icon: BookOpen },
    ],
  },
  {
    label: "Finances",
    items: [
      { to: "/expenses", label: "Expenses", icon: Receipt },
      { to: "/profit-margins", label: "Profit Margins", icon: TrendingUp },
    ],
  },
];

export const FLAT_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(group => group.items);
