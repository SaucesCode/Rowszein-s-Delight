/** "cancelled" is shown when a confirmed order's sale was cancelled in Sales. */
export type OrderStatus = "waiting" | "confirmed" | "declined" | "cancelled";

export interface OrderLine {
  product: number;
  name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  partner: string | null;
}

export interface OrderBox {
  box_size: number;
  assortment: number | null;
  name: string;
  size: number;
  price: string;
  contents: { product: number; product_name: string; quantity: number }[];
}

interface OrderLines {
  number: string;
  status: OrderStatus;
  delivery_date: string;
  town_name: string;
  items: OrderLine[];
  boxes: OrderBox[];
  subtotal: string;
  /** Null means the fee is confirmed when the shop replies. */
  delivery_fee: string | null;
  total: string;
  owner_message: string;
  created_at: string;
}

/** What the customer gets right after sending. */
export interface PlacedOrder extends OrderLines {
  token: string;
}

/** The customer's status page. */
export interface PublicOrder extends OrderLines {
  customer_first_name: string;
}

export interface OwnerOrderRow {
  id: number;
  number: string;
  status: OrderStatus;
  customer_name: string;
  town_name: string;
  delivery_date: string;
  total: string;
  created_at: string;
}

export interface OwnerOrder extends OrderLines {
  id: number;
  customer_name: string;
  phone: string;
  address: string;
  note: string;
  payment_method: string;
  decided_at: string | null;
  contact_cleared_at: string | null;
  sale: { id: number; status: "recorded" | "cancelled" } | null;
}

export interface OwnerOrderList {
  results: OwnerOrderRow[];
  count: number;
  next: number | null;
  previous: number | null;
  waiting_count: number;
  /** True while no "New-order emails go to" address is set. */
  email_problem: boolean;
}

export type OrderFilter = "waiting" | "confirmed" | "declined" | "all";
