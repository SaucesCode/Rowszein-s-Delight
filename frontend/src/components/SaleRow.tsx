import { Pencil, Trash2 } from "lucide-react";
import type { Sale } from "@/types/sale.types";

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function summarizeItems(sale: Sale) {
  const items = sale.sale_items ?? [];
  const names = items.map((i) => `${i.quantity}× ${i.product_name ?? "Item"}`);

  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

/**
 * A sale is considered "edited" when it was updated meaningfully after
 * creation — a 5s tolerance absorbs the immediate save-then-recompute
 * that happens on create (compute_total() re-saves the record).
 */
function wasEdited(sale: Sale) {
  const created = new Date(sale.created_at).getTime();
  const updated = new Date(sale.updated_at).getTime();
  return updated - created > 5000;
}

interface SaleRowProps {
  sale: Sale;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SaleRow({ sale, onEdit, onDelete }: SaleRowProps) {
  const itemCount = sale.sale_items?.length ?? 0;

  return (
    <div
      className="group/row flex items-center gap-4 px-4 py-3.5 sm:px-5 transition-colors hover:bg-[#FFF8F0]"
      style={{ borderTop: "1px solid #F5EDE0" }}
    >
      {/* Time */}
      <div className="w-16 flex-shrink-0 font-body" style={{ fontSize: 12.5, color: "#9B6644" }}>
        {formatTime(sale.created_at)}
      </div>

      {/* Summary */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-body truncate" style={{ fontSize: 13.5, color: "#3D3A35" }}>
            {summarizeItems(sale)}
          </p>
          <span
            className="flex-shrink-0 font-body font-semibold rounded-full"
            style={{ fontSize: 10.5, padding: "1.5px 7px", background: "#F1EFE8", color: "#7C7870" }}
          >
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
          {wasEdited(sale) && (
            <span
              className="flex-shrink-0 font-body font-semibold rounded-full"
              style={{ fontSize: 10.5, padding: "1.5px 7px", background: "#FFF0F7", color: "#E5528A" }}
            >
              Edited
            </span>
          )}
        </div>
        {sale.notes && (
          <p className="font-body truncate mt-0.5" style={{ fontSize: 12, color: "#B8A98D" }}>
            {sale.notes}
          </p>
        )}
      </div>

      {/* Total */}
      <div
        className="flex-shrink-0 font-heading font-semibold text-right"
        style={{ fontSize: 15, color: "#6B4226", minWidth: 84 }}
      >
        ₱{Number(sale.total_amount).toFixed(2)}
      </div>

      {/* Quick actions — always visible on touch, hover/focus-reveal on desktop */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ width: 32, height: 32, color: "#B8A98D" }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#FFF0F7";
            (e.currentTarget as HTMLElement).style.color = "#FF6FAE";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#B8A98D";
          }}
          aria-label={`Edit sale from ${formatTime(sale.created_at)}`}
        >
          <Pencil size={15} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ width: 32, height: 32, color: "#B8A98D" }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
            (e.currentTarget as HTMLElement).style.color = "#EF4444";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#B8A98D";
          }}
          aria-label={`Delete sale from ${formatTime(sale.created_at)}`}
        >
          <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}