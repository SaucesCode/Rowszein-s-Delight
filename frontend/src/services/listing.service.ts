import api from "./api";
import type { ListingParams } from "@/lib/listingParams";
import { listingParams } from "@/lib/listingParams";

export type LookupKind = "products" | "categories" | "ingredients";
export type ListKind = LookupKind | "recipes";
export type LookupRecord = { id: number; name: string; price?: number | string; unit?: string; cost_per_unit?: number | string };
export type Listing<T> = { success: boolean; data: { count: number; next: string | null; previous: string | null; results: T[] }; message: string };
const paths: Record<ListKind, string> = { products: "/products/", categories: "/products/categories/", ingredients: "/ingredients/", recipes: "/recipes/" };

export const listingService = {
  async get<T>(kind: ListKind, params: ListingParams, signal?: AbortSignal, publicOnly = false): Promise<Listing<T>> {
    if (publicOnly) {
      if (kind !== "products" && kind !== "categories") throw new Error("This listing is private.");
      const search = new URLSearchParams(Object.entries(listingParams(params)).map(([key, value]) => [key, String(value)]));
      // Even an owner visiting the storefront receives the anonymous projection.
      const response = await fetch(`/api${paths[kind]}?${search}`, { credentials: "omit", redirect: "error", signal });
      if (!response.ok) throw new Error("Unable to load the public catalog.");
      return response.json();
    }
    const response = await api.get(paths[kind], { params: listingParams(params), signal });
    return response.data;
  },
};
