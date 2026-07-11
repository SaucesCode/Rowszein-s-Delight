import type { ExpenseCategory } from "@/types/expense.types";

/**
 * Replaces ExpensesPage's old CATEGORY_BADGE map, which pointed at
 * `badge-purple` / `badge-orange` — classes that don't exist in index.css,
 * so those two categories were silently rendering unstyled. This uses only
 * hex values already established elsewhere in the app (pink-tint from
 * ProductCard's featured badge, brown-tint from CategoryFilterBar's count
 * pills) plus the three existing semantic badge tokens — no new colors.
 */
const CATEGORY_CONFIG: Record<ExpenseCategory, { bg: string; fg: string }> = {
  ingredient: { bg: "#EFF6FF", fg: "#1E40AF" }, // badge-info tokens
  packaging: { bg: "#FFF0F7", fg: "#E5528A" }, // pink tint, used app-wide
  utilities: { bg: "#FFFBEB", fg: "#B45309" }, // badge-warning tokens
  transportation: { bg: "#EFE7DA", fg: "#7C5A3D" }, // chocolate tint
  other: { bg: "#F1F5F9", fg: "#475569" }, // badge-neutral tokens
};

interface ExpenseCategoryBadgeProps {
  category: ExpenseCategory;
  label: string;
}

export default function ExpenseCategoryBadge({ category, label }: ExpenseCategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;

  return (
    <span
      className="inline-flex items-center font-body font-semibold rounded-full"
      style={{ background: config.bg, color: config.fg, fontSize: 11, padding: "3px 9px" }}
    >
      {label}
    </span>
  );
}
