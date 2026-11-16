import { useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Phone } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import { useConfirmOrder, useDeclineOrder, useOrder } from "@/hooks/useOrders";
import { deliveryDayLabel, displayPhone } from "@/lib/orderCheckout";
import { validRecordId } from "@/lib/managementQueryKeys";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { OwnerOrder } from "@/types/order.types";
import { PAYMENT_NAMES, STATUS_LABELS, actionMessage } from "./orders/orderLabels";
import "./orders/orders.css";
import "./shop/checkout.css";

const MESSAGE_LIMIT = 300;

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id);
  const query = useOrder(validRecordId(orderId) ? orderId : 0);
  const back = () => navigate("/orders");

  if (!validRecordId(orderId)) return <RecordLoadError name="order" invalidId error={undefined} retry={() => {}} back={back} />;
  if (query.isPending) {
    return (
      <div className="orders-page" aria-busy="true">
        <span className="skeleton block h-10 w-64" />
        <span className="skeleton mt-6 block h-64 w-full" aria-hidden="true" />
        <span className="sr-only" role="status">Loading the order</span>
      </div>
    );
  }
  if (query.isError || !query.data) return <RecordLoadError name="order" invalidId={false} error={query.error} retry={() => void query.refetch()} back={back} />;
  return <OrderDetail order={query.data} />;
}

function OrderDetail({ order }: { order: OwnerOrder }) {
  const ids = useId();
  const confirm = useConfirmOrder();
  const decline = useDeclineOrder();
  const [declining, setDeclining] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The action buttons disappear once the order is decided; keep the owner's place on the page.
  const focusHeading = () => requestAnimationFrame(() => headingRef.current?.focus());
  const waiting = order.status === "waiting";
  const dialPhone = order.phone.replace(/[^+0-9]/g, "");

  const doConfirm = () =>
    confirm.mutate(order.id, {
      onSuccess: () => {
        toast.success(`Order ${order.number} confirmed and recorded as a sale.`);
        focusHeading();
      },
      onError: error => toast.error(actionMessage(error, "Couldn't confirm the order. Try again.")),
    });

  const doDecline = () => {
    const text = message.trim();
    if (!text) {
      setMessageError("Tell the customer why, in a sentence.");
      return;
    }
    decline.mutate({ id: order.id, message: text }, {
      onSuccess: () => {
        setDeclining(false);
        setMessage("");
        toast.success(`Order ${order.number} declined.`);
        focusHeading();
      },
      onError: error => setMessageError(actionMessage(error, "Couldn't decline the order. Try again.")),
    });
  };

  return (
    <div className="orders-page">
      <Link to="/orders" className="orders-back"><ArrowLeft size={18} aria-hidden="true" /> All orders</Link>
      <header className="page-head orders-detail-head">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="type-page num orders-detail-title">{order.number}</h1>
          <p className="page-lede">{deliveryDayLabel(order.delivery_date)} · {order.town_name}</p>
        </div>
        <span className={`status-pill is-${order.status}`}>{STATUS_LABELS[order.status]}</span>
      </header>

      <div className="orders-detail-grid">
        <section className="orders-card" aria-labelledby={`${ids}-customer`}>
          <h2 id={`${ids}-customer`} className="orders-card-title">Customer</h2>
          <p className="orders-customer-name">{order.customer_name}</p>
          {order.contact_cleared_at ? (
            <p className="orders-muted">Contact details cleared after 90 days.</p>
          ) : (
            <>
              <div className="orders-contact">
                <a className="btn-secondary" href={`tel:${dialPhone}`}><Phone size={18} aria-hidden="true" /> Call <span className="num">{displayPhone(order.phone)}</span></a>
                <a className="btn-secondary" href={`sms:${dialPhone}`}><MessageSquare size={18} aria-hidden="true" /> Text</a>
              </div>
              <dl className="orders-facts">
                <div><dt>Address</dt><dd>{order.address}</dd></div>
                {order.note && <div><dt>Note</dt><dd>{order.note}</dd></div>}
              </dl>
            </>
          )}
          <dl className="orders-facts">
            <div><dt>Wants to pay by</dt><dd>{PAYMENT_NAMES[order.payment_method] ?? "Not said"}</dd></div>
            <div><dt>Sent</dt><dd>{new Date(order.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}</dd></div>
          </dl>
        </section>

        <section className="orders-card" aria-labelledby={`${ids}-lines`}>
          <h2 id={`${ids}-lines`} className="orders-card-title">What they ordered</h2>
          <ul className="order-status-lines">
            {order.boxes.map((box, index) => (
              <li key={`box-${index}`}>
                <span>{box.name}<small>{box.contents.map(content => `${content.quantity} ${content.product_name}`).join(", ")}</small></span>
                <span className="num">{formatPeso(Number(box.price))}</span>
              </li>
            ))}
            {order.items.map(line => (
              <li key={line.product}>
                <span>{line.quantity} × {line.name}{line.partner && <small>by {line.partner}</small>}</span>
                <span className="num">{formatPeso(Number(line.line_total))}</span>
              </li>
            ))}
          </ul>
          <dl className="checkout-totals">
            <div><dt>Items</dt><dd className="num">{formatPeso(Number(order.subtotal))}</dd></div>
            <div><dt>Delivery</dt><dd>{order.delivery_fee === null ? "To confirm" : formatPeso(Number(order.delivery_fee))}</dd></div>
            <div className="checkout-total"><dt>Total</dt><dd className="num">{formatPeso(Number(order.total))}</dd></div>
          </dl>
        </section>
      </div>

      {order.owner_message && <p className="orders-message"><strong>Your message to them:</strong> {order.owner_message}</p>}
      {order.sale && (
        <p className="orders-muted">
          Recorded in the <Link to="/sales">Sales register</Link>{order.sale.status === "cancelled" ? ", then cancelled there" : ""}.
        </p>
      )}

      {waiting && (
        <div className="orders-actions">
          <button type="button" className="btn-primary" onClick={doConfirm} disabled={confirm.isPending || decline.isPending} aria-busy={confirm.isPending}>
            {confirm.isPending ? "Confirming…" : "Confirm and record the sale"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setMessageError(null); setDeclining(true); }} disabled={confirm.isPending}>
            Decline
          </button>
        </div>
      )}

      <ConfirmDialog
        open={declining}
        title={`Decline ${order.number}?`}
        description="The customer sees your message on their order page. This can't be undone."
        confirmLabel="Decline order"
        cancelLabel="Keep it"
        destructive
        loading={decline.isPending}
        onConfirm={doDecline}
        onCancel={() => setDeclining(false)}
      >
        <label htmlFor={`${ids}-message`} className="field-label">Message for the customer</label>
        <textarea
          id={`${ids}-message`}
          className="field-input"
          rows={3}
          maxLength={MESSAGE_LIMIT}
          value={message}
          placeholder="Sorry, we're fully booked that day. Message us to pick another."
          aria-invalid={messageError ? true : undefined}
          aria-describedby={`${ids}-message-${messageError ? "error" : "count"}`}
          onChange={event => {
            setMessage(event.target.value);
            if (messageError) setMessageError(null);
          }}
        />
        {messageError
          ? <p id={`${ids}-message-error`} className="field-error">{messageError}</p>
          : <p id={`${ids}-message-count`} className="field-hint num">{message.length}/{MESSAGE_LIMIT}</p>}
      </ConfirmDialog>
    </div>
  );
}
