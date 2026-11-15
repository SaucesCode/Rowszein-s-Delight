import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import { useWaitingCount } from "@/hooks/useOrders";
import "./orders.css";

/** Home's "New orders" card; shown only while orders are waiting. */
export default function NewOrdersCard() {
  const { data: waiting = 0 } = useWaitingCount();
  if (!waiting) return null;
  return (
    <Link to="/orders" className="home-new-orders">
      <Inbox size={22} aria-hidden="true" />
      <span>
        <strong>{waiting === 1 ? "1 new order" : `${waiting} new orders`}</strong>
        <span className="home-new-orders-sub">Waiting for you to confirm</span>
      </span>
      <span className="home-new-orders-action">Open orders</span>
    </Link>
  );
}
