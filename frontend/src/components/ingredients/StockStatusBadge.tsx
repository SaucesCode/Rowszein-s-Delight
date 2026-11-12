import type { LucideIcon } from "lucide-react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";

export type StockStatus = "healthy" | "low_stock" | "out_of_stock";

const STATUS_CONFIG: Record<
  StockStatus,
  { label: string; bg: string; fg: string; border: string; icon: LucideIcon }
> = {
  healthy: {
    label: "In Stock",
    bg: "#E6F7F2",
    fg: "#0F766E",
    border: "#99E2D0",
    icon: CheckCircle2,
  },
  low_stock: {
    label: "Low Stock",
    bg: "#FFF0F5",
    fg: "#C7255E",
    border: "#F5CADB",
    icon: AlertTriangle,
  },
  out_of_stock: {
    label: "Out of Stock",
    bg: "#FEF2F2",
    fg: "#DC2626",
    border: "#FECACA",
    icon: XCircle,
  },
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
      className="inline-flex items-center gap-1 font-semibold rounded-full text-xs"
      style={{
        background: config.bg,
        color: config.fg,
        border: `1px solid ${config.border}`,
        padding: "3px 9px",
        fontSize: "0.75rem",
      }}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
