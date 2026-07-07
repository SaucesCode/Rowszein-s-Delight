import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  CakeSlice,
  BookOpen,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

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
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { to: "/ingredients", label: "Ingredients", icon: Package },
      { to: "/products", label: "Products", icon: CakeSlice },
      { to: "/recipes", label: "Recipes", icon: BookOpen },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/sales", label: "Sales", icon: ShoppingCart },
      { to: "/expenses", label: "Expenses", icon: Receipt },
      { to: "/profit-margins", label: "Profit Margins", icon: TrendingUp },
    ],
  },
];

export const FLAT_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(group => group.items);
