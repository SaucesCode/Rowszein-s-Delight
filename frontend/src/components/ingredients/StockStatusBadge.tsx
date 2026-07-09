import type { LucideIcon } from "lucide-react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";

export type StockStatus = "healthy" | "low_stock" | "out_of_stock";

const STATUS_CONFIG: Record<
  StockStatus,
  { label: string; bg: string; fg: string; icon: LucideIcon }
> = {
  healthy: { label: "Healthy", bg: "#EAF3DE", fg: "#3F6B1F", icon: CheckCircle2 },
  low_stock: { label: "Low Stock", bg: "#FFF3DC", fg: "#946200", icon: AlertTriangle },
  out_of_stock: { label: "Out of Stock", bg: "#FEF2F2", fg: "#B91C1C", icon: XCircle },
};

export function resolveStockStatus(
  ingredient: Pick<Ingredient, "quantity" | "is_low_stock">,
): StockStatus {
  if (Number(ingredient.quantity) <= 0) return "out_of_stock";
  if (ingredient.is_low_stock) return "low_stock";
  return "healthy";
}

export default function StockStatusBadge({ status }: { status: StockStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 font-body font-semibold rounded-full"
      style={{ background: config.bg, color: config.fg, fontSize: 11, padding: "3px 9px" }}
    >
      <Icon size={11} strokeWidth={2.5} aria-hidden="true" />
      {config.label}
    </span>
  );
}
