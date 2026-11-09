export interface SaleItem {
  id?: number;
  product: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

export interface Sale {
  id: number;
  date: string;
  notes: string;
  sale_items: SaleItem[];
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
}
