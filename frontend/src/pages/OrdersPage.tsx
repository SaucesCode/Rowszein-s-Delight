import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Inbox } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { deliveryDayLabel } from "@/lib/orderCheckout";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { OrderFilter } from "@/types/order.types";
import { FILTERS, STATUS_LABELS } from "./orders/orderLabels";
import "./orders/orders.css";

/** Orders customers sent from the shop, newest first. Refreshes every minute while open. */
export default function OrdersPage() {
  const [filter, setFilter] = useState<OrderFilter>("waiting");
  const [page, setPage] = useState(1);
  const query = useOrders(filter, page);
  const data = query.data;

  const choose = (next: OrderFilter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="orders-page">
      <header className="page-head">
        <div>
          <h1 className="type-page">Orders</h1>
          <p className="page-lede">Orders customers sent from the shop. Confirm one to record it as a sale; decline it with a short reason they'll see.</p>
        </div>
      </header>

      {data?.email_problem && (
        <p className="orders-banner" role="status">
          {data.email_problem_text === "No email address set" ? (
            <>New-order emails can't be sent yet: set the address in <Link to="/settings">Shop settings</Link>, under Contact.</>
          ) : (
            <>
              New-order emails aren't reaching you ({data.email_problem_text}). Check "New-order emails go to" in{" "}
              <Link to="/settings">Shop settings</Link>; with Resend's free plan it must be your Resend account's address.
            </>
          )}
        </p>
      )}

      <div className="chip-row orders-filters" role="group" aria-label="Show">
        {FILTERS.map(option => (
          <button key={option.value} type="button" className="chip" aria-pressed={filter === option.value} onClick={() => choose(option.value)}>
            {option.label}
            {option.value === "waiting" && data ? <span className="orders-chip-count num">{data.waiting_count}</span> : null}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <div className="orders-list" aria-busy="true">
          {[0, 1, 2].map(index => <span key={index} className="skeleton orders-skeleton" aria-hidden="true" />)}
          <span className="sr-only" role="status">Loading orders</span>
        </div>
      ) : query.isError ? (
        <div role="alert" className="card-surface p-6">
          <p>Couldn't load the orders. Check the internet connection, then try again.</p>
          <button type="button" className="btn-primary mt-4" onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : data && data.results.length === 0 ? (
        <div className="orders-empty">
          <Inbox size={28} aria-hidden="true" />
          <p>{filter === "waiting" ? "No orders waiting. New orders from the shop appear here." : "Nothing here yet."}</p>
        </div>
      ) : data ? (
        <>
          <ul className="orders-list" aria-label={`${FILTERS.find(option => option.value === filter)?.label} orders`}>
            {data.results.map(order => (
              <li key={order.id}>
                <Link to={`/orders/${order.id}`} className="orders-row">
                  <span className="orders-row-main">
                    <span className="orders-row-number num">{order.number}</span>
                    <span className="orders-row-name">{order.customer_name || "Customer"}</span>
                    <span className="orders-row-meta">{deliveryDayLabel(order.delivery_date)} · {order.town_name}</span>
                  </span>
                  <span className="orders-row-side">
                    <span className={`status-pill is-${order.status}`}>{STATUS_LABELS[order.status]}</span>
                    <span className="num">{formatPeso(Number(order.total))}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="orders-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
          {(data.previous || data.next) && (
            <nav className="orders-pages" aria-label="Pages">
              <button type="button" className="btn-secondary" disabled={!data.previous} onClick={() => setPage(data.previous ?? 1)}>Newer</button>
              <span className="num">Page {page}</span>
              <button type="button" className="btn-secondary" disabled={!data.next} onClick={() => setPage(data.next ?? page)}>Older</button>
            </nav>
          )}
        </>
      ) : null}
    </div>
  );
}
