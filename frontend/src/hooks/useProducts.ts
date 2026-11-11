import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productService } from "@/services/product.service";
import type { ProductPayload } from "@/types/product.types";
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
      toast.success("Product created.");
      navigate("/products");
    },
    onError: () => {
      toast.error("Failed to create product.");
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
      toast.success("Product updated.");
      navigate("/products");
    },
    onError: () => {
      toast.error("Failed to update product.");
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
      toast.success("Product deleted.");
    },
    onError: () => {
      toast.error("Failed to delete product.");
    },
  });
}
