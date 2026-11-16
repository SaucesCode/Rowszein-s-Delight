export interface BoxSize {
  id: number;
  size: number;
  price: string;
  is_available: boolean;
  /** Most different donuts in one box; a box always fills evenly between them. */
  max_flavors: number;
}

export interface AssortmentItem {
  product_id: number;
  name: string;
  category: string;
  quantity: number;
  box_extra: string;
  is_available: boolean;
  image_url: string | null;
}

export interface Assortment {
  id: number;
  name: string;
  description: string;
  box_size: BoxSize;
  items: AssortmentItem[];
  price: string;
  is_complete: boolean;
  /** False when it breaks its size's flavour rule (the shop hides it). */
  follows_rule: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface AssortmentPayload {
  name: string;
  description: string;
  box_size_id: number;
  is_available: boolean;
  contents: { product_id: number; quantity: number }[];
}

export interface BoxSizePayload {
  size?: number;
  price?: number;
  is_available?: boolean;
  max_flavors?: number;
}

/** What the online shop can sell right now. */
export interface ShopBoxes {
  sizes: { id: number; size: number; price: string; max_flavors: number }[];
  assortments: {
    id: number;
    name: string;
    description: string;
    box_size_id: number;
    size: number;
    items: AssortmentItem[];
    price: string;
  }[];
}
