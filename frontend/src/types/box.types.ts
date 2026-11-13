export interface BoxSize {
  id: number;
  size: number;
  price: string;
  is_available: boolean;
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
}

/** What the online shop can sell right now. */
export interface ShopBoxes {
  sizes: { id: number; size: number; price: string }[];
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
