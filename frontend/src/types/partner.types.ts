/** What staff and the shop see about a partner. */
export interface PartnerSummary {
  id: number;
  name: string;
  blurb: string;
  is_active: boolean;
  sort_order: number;
}

/** The owner's full view, including private contact details. */
export interface Partner extends PartnerSummary {
  contact: string;
  notes: string;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerPayload {
  name: string;
  blurb: string;
  contact: string;
  notes: string;
  is_active: boolean;
}

export interface PartnerPayment {
  id: number;
  date: string;
  amount: string;
  note: string;
  recorded_by_name: string;
  created_at: string;
  voided_at: string | null;
  void_reason: string;
}

export interface PartnerPaymentPayload {
  date: string;
  amount: string;
  note: string;
}

export interface PartnerOwedItem {
  product: number;
  product_name: string;
  quantity: number;
  payout: string;
  owed: string;
}

export interface PartnerOwed {
  id: number;
  name: string;
  owed: string;
  /** Negative when the partner has been paid ahead. */
  still_to_pay: string;
  is_active: boolean;
  items: PartnerOwedItem[];
}

export interface PartnerPayouts {
  partners: PartnerOwed[];
  total: string;
  filters: { date_from: string; date_to: string };
}
