import type { LucideIcon } from "lucide-react";
import { Check, EyeOff, Sparkles, AlertTriangle } from "lucide-react";

export type ProductStatus = "available" | "hidden" | "seasonal" | "out_of_stock";

const STATUS_CONFIG: Record<
  ProductStatus,
  { label: string; bg: string; fg: string; icon: LucideIcon }
> = {
  available: { label: "Available", bg: "#EAF3DE", fg: "#3F6B1F", icon: Check },
  hidden: { label: "Hidden", bg: "#F1EFE8", fg: "#7C7870", icon: EyeOff },
  seasonal: { label: "Seasonal", bg: "#FFF0F7", fg: "#E5528A", icon: Sparkles },
  out_of_stock: { label: "Out of stock", bg: "#FEF2F2", fg: "#B91C1C", icon: AlertTriangle },
};

export default function StatusBadge({ status }: { status: ProductStatus }) {
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
