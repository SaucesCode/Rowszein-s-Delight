export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number | string;
  image_url: string | null;
  category: Category;
  is_available: boolean;
  is_featured: boolean;
  /**
   * Optional, forward-compatible fields. Not yet returned by the API —
   * see the Products page notes for what each needs on the backend.
   * The UI simply omits the related badge until these are present.
   */
  is_seasonal?: boolean;
  is_out_of_stock?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductPayload {
  name: string;
  description?: string;
  price: number;
  category_id: number;
  is_available: boolean;
  is_featured: boolean;
  image?: File | null;
}
