export interface SaleItem {
  id?: number;
  product: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

/** A box as recorded on a sale: fixed once saved. */
export interface SaleBox {
  key: string;
  box_size_id: number;
  size: number;
  assortment_id: number | null;
  name: string;
  price: string;
  contents: { product: number; product_name: string; quantity: number; box_extra: string }[];
}

export type SaleBoxPayload =
  | { key: string }
  | { box_size: number; contents: { product: number; quantity: number }[]; price?: number }
  | { assortment: number; price?: number };

export interface Sale {
  id: number;
  date: string;
  notes: string;
  sale_items: SaleItem[];
  boxes?: SaleBox[];
  total_amount: number;
  created_at: string;
  updated_at: string;
  revision: string;
  status: "recorded" | "cancelled";
  inventory_tracking: "legacy_unknown" | "tracked";
}

export interface SalePayload {
  date: string;
  notes?: string;
  sale_items: {
    product: number;
    quantity: number;
    unit_price: number;
  }[];
  boxes?: SaleBoxPayload[];
}
