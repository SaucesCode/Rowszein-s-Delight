import type { Ref } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download } from "lucide-react";
import { deliveryDayLabel } from "@/lib/orderCheckout";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { PlacedOrder } from "@/types/order.types";

interface OrderSentProps {
  order: PlacedOrder;
  phone: string;
  headingRef: Ref<HTMLHeadingElement>;
  savingCard: boolean;
  cardNote: string | null;
  onSaveCard: () => void;
  onDone: () => void;
  /** Shown when this is an earlier order a retry tried to change; the picture is then not offered. */
  notice?: string;
}

/** What the customer sees right after sending: their real order number and where to check on it. */
export default function OrderSent({ order, phone, headingRef, savingCard, cardNote, onSaveCard, onDone, notice }: OrderSentProps) {
  return (
    <div className="order-sent">
      <CheckCircle2 className="order-sent-icon" size={40} aria-hidden="true" />
      <h3 ref={headingRef} tabIndex={-1} className="order-sent-title">{notice ? "Already sent" : "Order sent"}</h3>
      <p className="order-sent-number num">{order.number}</p>
      {notice && <p className="checkout-problems" role="alert">{notice}</p>}
      <p>
        We'll confirm by text or call on <strong className="num">{phone}</strong>. Your order is for{" "}
        {deliveryDayLabel(order.delivery_date)} in {order.town_name}, {formatPeso(Number(order.total))}
        {order.delivery_fee === null ? " plus delivery." : "."}
      </p>
      <div className="order-sent-actions">
        <Link className="btn-primary" to={`/order/${order.token}`}>Check your order</Link>
        {!notice && (
          <button type="button" className="btn-secondary" onClick={onSaveCard} disabled={savingCard} aria-busy={savingCard}>
            <Download size={18} aria-hidden="true" />
            {savingCard ? "Saving…" : "Save a picture of it"}
          </button>
        )}
      </div>
      <p className="box-sheet-help" role="status">{cardNote ?? "Keep the link to check whether we've confirmed it."}</p>
      <button type="button" className="link-button" onClick={onDone}>Back to the shop</button>
    </div>
  );
}
