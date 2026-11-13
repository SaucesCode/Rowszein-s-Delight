import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productService } from "@/services/product.service";
import type { Product, ProductPayload } from "@/types/product.types";
import toast from "react-hot-toast";
import { useMe } from "@/hooks/useAuth";
import { listingParams, type ListingParams } from "@/lib/listingParams";
import { queryScope, requestedRecord, validRecordId } from "@/lib/managementQueryKeys";
import { can } from "@/lib/permissions";

export function useProducts(page = 1, params: ListingParams = {}) {
  const auth = useMe();
  return useQuery({
    queryKey: ["products", "list", queryScope(auth.data), listingParams({ ...params, page })],
    queryFn: ({ signal }) => productService.getAll(page, params, signal),
    enabled: !auth.isPending,
    retry: false,
  });
}

const SELLABLE_PAGE_LIMIT = 10;

/** Every donut currently in the shop, across pages, for the sales register. */
export function useSellableProducts() {
  const auth = useMe();
  return useQuery({
    queryKey: ["products", "sellable", queryScope(auth.data)],
    queryFn: async ({ signal }) => {
      const products: Product[] = [];
      for (let page = 1; page <= SELLABLE_PAGE_LIMIT; page += 1) {
        const listing = await productService.getAll(page, { is_available: true, ordering: "name", page_size: 20 }, signal);
        products.push(...listing.data.results);
        if (!listing.data.next) break;
      }
      return products;
    },
    enabled: !auth.isPending,
  });
}

export function useCategories() {
  const auth = useMe();
  return useQuery({
    queryKey: ["product-categories", "list", queryScope(auth.data)],
    queryFn: () => productService.getCategories(),
    enabled: !auth.isPending,
  });
}

export function useProduct(id: number) {
  const auth = useMe();
  return useQuery({
    queryKey: ["products", "detail", queryScope(auth.data), id],
    queryFn: async () => requestedRecord(id, await productService.getOne(id)),
    enabled: validRecordId(id) && can(auth.data, "catalog.read"),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: ProductPayload) => productService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success("Donut added to your collection.");
      navigate("/products");
    },
    onError: () => {
      toast.error("Couldn't add the donut. Check the connection and try again.");
    },
  });
}

export function useUpdateProduct(id: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: ProductPayload) => productService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success("Changes saved.");
      navigate("/products");
    },
    onError: () => {
      toast.error("Couldn't save the changes. Check the connection and try again.");
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => productService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success("Donut deleted.");
    },
    onError: () => {
      toast.error("Couldn't delete the donut. Check the connection and try again.");
    },
  });
}
