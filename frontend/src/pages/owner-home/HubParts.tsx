import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import LevelBar from "@/components/LevelBar";
import { formatAmount, stockStatus } from "@/lib/stockStatus";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Sale } from "@/types/sale.types";
import type { HubSnapshot, Metric } from "./useHubSnapshot";

const timeFormatter = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

function MetricSlot<T>({ metric, width, children }: { metric: Metric<T>; width: string; children: (value: T) => ReactNode }) {
  if (metric.state === "loading") {
    return (
      <>
        <span className="skeleton home-skeleton" style={{ width }} aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </>
    );
  }
  if (metric.state === "error") {
    return (
      <span className="home-error">
        Couldn't load this.{" "}
        <button type="button" onClick={metric.retry}>Try again</button>
      </span>
    );
  }
  return <>{children(metric.value)}</>;
}

const orderItems = (sale: Sale) =>
  sale.sale_items.map(item => `${item.quantity}× ${item.product_name ?? "Donut"}`).join(", ");

function OrderFeed({ orders }: { orders: Sale[] }) {
  if (orders.length === 0) {
    return <p className="home-quiet">No orders yet. The first one will show up here.</p>;
  }
  return (
    <ol className="home-orders">
      {orders.map(order => (
        <li key={order.id} data-cancelled={order.status === "cancelled" || undefined}>
          <time className="home-order-time num" dateTime={order.created_at}>
            {timeFormatter.format(new Date(order.created_at))}
          </time>
          <span className="home-order-items">{orderItems(order)}</span>
          <span className="home-order-total num">
            {order.status === "cancelled" ? "Cancelled" : formatPeso(Number(order.total_amount))}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TodaySection({ snapshot }: { snapshot: HubSnapshot }) {
  const { salesToday, ordersToday, bestSeller, latestOrders } = snapshot;

  return (
    <section className="home-today" aria-labelledby="home-today-title">
      <h2 id="home-today-title" className="home-kicker">Sold today</h2>
      <p className="home-amount num">
        <MetricSlot metric={salesToday} width="6ch">{value => formatPeso(value)}</MetricSlot>
      </p>
      <p className="home-today-line">
        <MetricSlot metric={ordersToday} width="5ch">
          {count => `${count} ${count === 1 ? "order" : "orders"}`}
        </MetricSlot>
        <MetricSlot metric={bestSeller} width="12ch">
          {top => (top ? <>. Best seller so far: <strong>{top.name}</strong>, {top.quantity} sold</> : null)}
        </MetricSlot>
      </p>

      <div className="home-feed">
        <div className="home-feed-head">
          <h3>Latest orders</h3>
          <Link to="/sales" className="home-link">
            All of today's sales
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <MetricSlot metric={latestOrders} width="100%">{orders => <OrderFeed orders={orders} />}</MetricSlot>
      </div>
    </section>
  );
}

const ATTENTION_LIMIT = 5;

export function AttentionSection({ snapshot }: { snapshot: HubSnapshot }) {
  return (
    <section className="home-attention" aria-labelledby="home-attention-title">
      <h2 id="home-attention-title" className="home-kicker">Needs attention</h2>
      <MetricSlot metric={snapshot.lowStock} width="100%">
        {items =>
          items.length === 0 ? (
            <div className="home-calm">
              <span className="home-calm-icon" aria-hidden="true">
                <Check size={22} strokeWidth={2.25} />
              </span>
              <p>Everything in the pantry is above its restock level.</p>
            </div>
          ) : (
            <>
              <p className="home-attention-lede">
                {items.length === 1 ? "1 ingredient is running low." : `${items.length} ingredients are running low.`}
              </p>
              <ul className="home-low">
                {items.slice(0, ATTENTION_LIMIT).map(item => (
                  <li key={item.id}>
                    <Link to={`/ingredients?item=${item.id}`} className="home-low-row">
                      <span className="home-low-text">
                        <span className="home-low-name">{item.name}</span>
                        <span className="home-low-sub">
                          {stockStatus(item) === "out"
                            ? "None left"
                            : `${formatAmount(item.quantity, item.unit)} left of ${formatAmount(item.minimum_stock, item.unit)}`}
                        </span>
                      </span>
                      <LevelBar ingredient={item} />
                    </Link>
                  </li>
                ))}
              </ul>
              {items.length > ATTENTION_LIMIT && (
                <p className="home-quiet">And {items.length - ATTENTION_LIMIT} more in the pantry.</p>
              )}
              <Link to="/ingredients" className="btn-secondary home-attention-action">Restock in the pantry</Link>
            </>
          )
        }
      </MetricSlot>
    </section>
  );
}

export function WeekStrip({ snapshot, showProfit }: { snapshot: HubSnapshot; showProfit: boolean }) {
  return (
    <section className="home-week" aria-labelledby="home-week-title">
      <h2 id="home-week-title" className="home-kicker">This week</h2>
      <MetricSlot metric={snapshot.week} width="100%">
        {week => (
          <dl className="home-week-figures">
            <div>
              <dt>Sold</dt>
              <dd className="num">{formatPeso(week.sold)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd className="num">{formatPeso(week.spent)}</dd>
            </div>
            <div>
              <dt>{week.profit >= 0 ? "Profit" : "Loss"}</dt>
              <dd className={`num ${week.profit >= 0 ? "is-good" : "is-warn"}`}>{formatPeso(Math.abs(week.profit))}</dd>
            </div>
          </dl>
        )}
      </MetricSlot>
      {showProfit && (
        <Link to="/analytics" className="home-link">
          See profit and trends
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
