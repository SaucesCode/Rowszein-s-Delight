import { Link } from "react-router-dom";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Sale } from "@/types/sale.types";

const receiptTime = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

/** Updated meaningfully after creation; 5s absorbs the server's re-save while totalling. */
const wasEdited = (sale: Sale) => new Date(sale.updated_at).getTime() - new Date(sale.created_at).getTime() > 5000;

/** One sale as a paper receipt: itemised lines with leaders, the total, and its actions. */
export default function Receipt({
  sale,
  canManage,
  onCancel,
}: {
  sale: Sale;
  canManage: boolean;
  onCancel: (sale: Sale) => void;
}) {
  const cancelled = sale.status === "cancelled";
  const legacy = sale.inventory_tracking === "legacy_unknown";
  const time = receiptTime.format(new Date(sale.created_at));

  return (
    <article className="receipt" data-cancelled={cancelled || undefined} aria-label={`Sale at ${time}`}>
      <header className="receipt-head">
        <time className="num" dateTime={sale.created_at}>{time}</time>
        {cancelled ? (
          <span className="receipt-stamp">Cancelled</span>
        ) : legacy ? (
          <span className="receipt-tag">Before stock tracking</span>
        ) : (
          wasEdited(sale) && <span className="receipt-tag">Edited</span>
        )}
      </header>

      <ul className="receipt-items">
        {sale.sale_items.map((item, index) => (
          <li key={item.id ?? index}>
            <span className="receipt-qty num">{item.quantity}×</span>
            <span className="receipt-name">{item.product_name ?? "Donut"}</span>
            <span className="receipt-leader" aria-hidden="true" />
            <span className="receipt-amount num">{formatPeso(Number(item.unit_price) * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <p className="receipt-total">
        <span>Total</span>
        <strong className="num">{formatPeso(Number(sale.total_amount))}</strong>
      </p>

      {sale.notes && <p className="receipt-note">{sale.notes}</p>}

      {canManage && !cancelled && !legacy && (
        <footer className="receipt-actions">
          <Link to={`/sales/${sale.id}/edit`} className="btn-ghost">
            Edit<span className="sr-only"> the sale at {time}</span>
          </Link>
          <button type="button" className="btn-ghost receipt-cancel" onClick={() => onCancel(sale)}>
            Cancel sale<span className="sr-only"> at {time}</span>
          </button>
        </footer>
      )}
    </article>
  );
}
