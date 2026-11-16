import { Link, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useOrderStatus } from "@/hooks/useOrders";
import { useShopSettings } from "@/hooks/useShopSettings";
import { deliveryDayLabel } from "@/lib/orderCheckout";
import { shopContact } from "@/lib/shopSettings";
import { formatPeso } from "@/pages/dashboard/report-format";
import { OrderRequestError } from "@/services/order.service";
import type { OrderStatus, PublicOrder } from "@/types/order.types";
import "./shop/shop.css";
import "./shop/checkout.css";

const STATUS_TEXT: Record<OrderStatus, { label: string; line: string }> = {
  waiting: { label: "Waiting for confirmation", line: "We've got your order. We'll text or call you to confirm it." },
  confirmed: { label: "Confirmed", line: "Your order is confirmed. See you on delivery day." },
  declined: { label: "Sorry, we can't do this one", line: "We couldn't take this order." },
  cancelled: { label: "Cancelled", line: "This order was cancelled." },
};

/** The customer's page for one order, found by the link they got after sending it. */
export default function OrderStatusPage() {
  const { token = "" } = useParams();
  const query = useOrderStatus(token);
  const settings = useShopSettings();
  const contact = shopContact(settings.data);

  return (
    <div className="shop order-status-page">
      <Link className="order-status-brand" to="/">Rowszein's Delight</Link>
      <main className="order-status-card" aria-busy={query.isPending}>
        {query.isPending ? (
          <>
            <span className="skeleton block h-8 w-48" aria-hidden="true" />
            <span className="skeleton block h-32 w-full" aria-hidden="true" />
            <span className="sr-only" role="status">Loading your order</span>
          </>
        ) : query.isError ? (
          <div role="alert">
            <h1>{query.error instanceof OrderRequestError && query.error.status === 404 ? "We couldn't find this order" : "Your order didn't load"}</h1>
            <p>
              {query.error instanceof OrderRequestError && query.error.status === 404
                ? "Check the link, or message us with your order number."
                : "Check your connection, then try again."}
            </p>
            <div className="order-status-actions">
              {!(query.error instanceof OrderRequestError && query.error.status === 404) && (
                <button type="button" className="btn-primary" onClick={() => void query.refetch()}>Try again</button>
              )}
              <a className="btn-secondary" href={contact.messenger_url} target="_blank" rel="noopener noreferrer">Message us</a>
            </div>
          </div>
        ) : (
          <OrderDetails order={query.data} messengerUrl={contact.messenger_url} />
        )}
      </main>
    </div>
  );
}

function OrderDetails({ order, messengerUrl }: { order: PublicOrder; messengerUrl: string }) {
  const text = STATUS_TEXT[order.status];
  return (
    <>
      <div className="order-status-head">
        <span className="order-status-number num">{order.number}</span>
        <span className={`status-pill is-${order.status}`}>{text.label}</span>
      </div>
      <h1>{order.customer_first_name ? `Thanks, ${order.customer_first_name}.` : "Your order"}</h1>
      <p>{text.line}</p>
      {order.owner_message && <p className="order-status-message">{order.owner_message}</p>}
      <p>Delivery on <strong>{deliveryDayLabel(order.delivery_date)}</strong> in {order.town_name}.</p>
      <ul className="order-status-lines" aria-label="What you ordered">
        {order.boxes.map((box, index) => (
          <li key={`box-${index}`}>
            <span>
              {box.name}
              <small>{box.contents.map(content => `${content.quantity} ${content.product_name}`).join(", ")}</small>
            </span>
            <span className="num">{formatPeso(Number(box.price))}</span>
          </li>
        ))}
        {order.items.map(line => (
          <li key={line.product}>
            <span>{line.quantity} × {line.name}</span>
            <span className="num">{formatPeso(Number(line.line_total))}</span>
          </li>
        ))}
      </ul>
      <dl className="checkout-totals">
        <div>
          <dt>Delivery</dt>
          <dd>{order.delivery_fee === null ? "Confirmed when we reply" : Number(order.delivery_fee) === 0 ? "Free" : formatPeso(Number(order.delivery_fee))}</dd>
        </div>
        <div className="checkout-total"><dt>Total</dt><dd className="num">{formatPeso(Number(order.total))}</dd></div>
      </dl>
      <div className="order-status-actions">
        <a className="btn-secondary" href={messengerUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={18} aria-hidden="true" /> Message us
        </a>
        <Link className="link-button" to="/">Back to the shop</Link>
      </div>
    </>
  );
}
