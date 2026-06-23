export type ProductCategory = "classic" | "fruity" | "local" | "premium" | "brownies";

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: ProductCategory;
  category_display?: string;
  is_available: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPayload {
  name: string;
  description?: string;
  price: number;
  category: ProductCategory;
  is_available: boolean;
  is_featured: boolean;
  image?: File | null;
}
