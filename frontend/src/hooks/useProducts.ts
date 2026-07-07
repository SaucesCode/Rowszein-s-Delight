import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productService } from "@/services/product.service";
import type { ProductPayload } from "@/types/product.types";
import toast from "react-hot-toast";

export function useProducts(page = 1) {
  return useQuery({
    queryKey: ["products", page],
    queryFn: () => productService.getAll(page),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["product-categories"],
    queryFn: () => productService.getCategories(),
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: () => productService.getOne(id),
    enabled: !!id,
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
