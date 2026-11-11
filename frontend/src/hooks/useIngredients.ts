import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ingredientService } from "@/services/ingredient.service";
import type { IngredientPayload } from "@/types/ingredient.types";
import toast from "react-hot-toast";
import { useOperationIdentity } from "@/hooks/useOperationIdentity";
import { apiErrorMessage } from "@/lib/csrfTransport";
import { ingredientKeys, requestedRecord, validRecordId } from "@/lib/managementQueryKeys";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import type { ListingParams } from "@/lib/listingParams";

export function useIngredients(page = 1, params: ListingParams = {}) {
  const { data: actor } = useMe();
  return useQuery({
    queryKey: ingredientKeys.list(actor, page, params),
    queryFn: ({ signal }) => ingredientService.getAll(page, params, signal),
    enabled: can(actor, "stock.read"),
    retry: false,
  });
}

export function useIngredient(id: number) {
  const { data: actor } = useMe();
  const enabled = validRecordId(id) && can(actor, "stock.manage");
  const query = useQuery({
    queryKey: ingredientKeys.detail(actor, id),
    queryFn: async () => requestedRecord(id, await ingredientService.getOne(id)),
    enabled,
    retry: false,
  });
  return { ...query, data: enabled && !query.isError && query.data?.id === id ? query.data : undefined };
}

export function useLowStockIngredients() {
  const { data: actor } = useMe();
  return useQuery({
    queryKey: ingredientKeys.lowStock(actor),
    queryFn: ingredientService.getLowStock,
    enabled: can(actor, "stock.read"),
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: IngredientPayload) => ingredientService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
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
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
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
  const identity = useOperationIdentity();

  return useMutation({
    mutationFn: (payload: { delta: string; reason: string; revision: string }) => {
      const operation = identity.get(`stock:adjust:${id}`, payload.revision);
      return ingredientService.adjust(id, payload.delta, payload.reason, operation.key, operation.revision!);
    },
    onSuccess: () => {
      identity.clear(`stock:adjust:${id}`);
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Stock updated.");
    },
    onError: (error) => {
      identity.reject(`stock:adjust:${id}`, error);
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
      toast.error(apiErrorMessage(error, "Failed to update stock. Reload before retrying a stale balance."));
    },
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => ingredientService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
      toast.success("Ingredient deleted.");
    },
    onError: () => {
      toast.error("Failed to delete ingredient.");
    },
  });
}
