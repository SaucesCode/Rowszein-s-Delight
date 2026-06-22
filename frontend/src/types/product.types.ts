export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPayload {
  name: string;
  description?: string;
  price: number;
  is_available: boolean;
  is_featured: boolean;
  image?: File | null;
}