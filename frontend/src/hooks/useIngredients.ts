import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ingredientService } from "@/services/ingredient.service";
import type { IngredientPayload } from "@/types/ingredient.types";
import toast from "react-hot-toast";

export function useIngredients(page = 1) {
  return useQuery({
    queryKey: ["ingredients", page],
    queryFn: () => ingredientService.getAll(page),
  });
}

export function useIngredient(id: number) {
  return useQuery({
    queryKey: ["ingredients", id],
    queryFn: () => ingredientService.getOne(id),
    enabled: !!id,
  });
}

export function useLowStockIngredients() {
  return useQuery({
    queryKey: ["ingredients", "low-stock"],
    queryFn: ingredientService.getLowStock,
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: IngredientPayload) => ingredientService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingredient created.");
      navigate("/ingredients");
    },
    onError: () => {
      toast.error("Failed to create ingredient.");
    },
  });
}

export function useUpdateIngredient(id: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: IngredientPayload) => ingredientService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingredient updated.");
      navigate("/ingredients");
    },
    onError: () => {
      toast.error("Failed to update ingredient.");
    },
  });
}

/**
 * Dedicated stock-adjustment mutation used by UpdateStockModal. Distinct from
 * useUpdateIngredient because it stays on the Ingredients page (no navigate)
 * and gives stock-specific toast copy.
 */
export function useUpdateStock(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: IngredientPayload) => ingredientService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Stock updated.");
    },
    onError: () => {
      toast.error("Failed to update stock.");
    },
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => ingredientService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingredient deleted.");
    },
    onError: () => {
      toast.error("Failed to delete ingredient.");
    },
  });
}
