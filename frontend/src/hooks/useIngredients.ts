import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ingredientService } from "@/services/ingredient.service";
import type { Ingredient, IngredientPayload } from "@/types/ingredient.types";
import toast from "react-hot-toast";
import { useOperationIdentity } from "@/hooks/useOperationIdentity";
import { apiErrorMessage } from "@/lib/csrfTransport";
import { isAxiosError } from "axios";
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

/** Every ingredient, across pages, for pickers such as the recipe form. */
export function useAllIngredients() {
  const { data: actor } = useMe();
  return useQuery({
    queryKey: [...ingredientKeys.all, "every", actor?.id ?? null],
    queryFn: async ({ signal }) => {
      const ingredients: Ingredient[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const listing = await ingredientService.getAll(page, { ordering: "name", page_size: 20 }, signal);
        ingredients.push(...listing.data.results);
        if (!listing.data.next) break;
      }
      return ingredients;
    },
    enabled: can(actor, "stock.read"),
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

/** The ingredient endpoints answer 409 with a plain string for rules Rose can act on. */
function conflictMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error) || error.response?.status !== 409) return apiErrorMessage(error, fallback);
  const detail = String(error.response.data?.error ?? "");
  if (detail.includes("units cannot be changed")) {
    return "This ingredient already has stock history, so its unit can't change. Add a new ingredient for the new unit.";
  }
  if (detail.includes("must be retained")) {
    return "This ingredient is used in a recipe or has stock history, so it can't be deleted.";
  }
  if (detail.includes("stock adjustment endpoint")) {
    return "Stock amounts change from the pantry's Update stock panel, not from this form.";
  }
  return fallback;
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: IngredientPayload) => ingredientService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
      toast.success("Ingredient added to the pantry.");
      navigate("/ingredients");
    },
    onError: (error) => {
      toast.error(conflictMessage(error, "Couldn't add the ingredient. Check the connection and try again."));
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
      toast.success("Changes saved.");
      navigate("/ingredients");
    },
    onError: (error) => {
      toast.error(conflictMessage(error, "Couldn't save the changes. Check the connection and try again."));
    },
  });
}

/**
 * Revision-checked, idempotent stock adjustment used by the pantry's Update
 * stock panel. Stays on the page (no navigate); the caller can pass the
 * confirmation wording, e.g. "Bread flour: 5 kg added".
 */
export function useUpdateStock(id: number) {
  const queryClient = useQueryClient();
  const identity = useOperationIdentity();

  return useMutation({
    mutationFn: (payload: { delta: string; reason: string; revision: string; successMessage?: string }) => {
      const operation = identity.get(`stock:adjust:${id}`, payload.revision);
      return ingredientService.adjust(id, payload.delta, payload.reason, operation.key, operation.revision!);
    },
    onSuccess: (_data, payload) => {
      identity.clear(`stock:adjust:${id}`);
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(payload.successMessage ?? "Stock updated.");
    },
    onError: (error) => {
      identity.reject(`stock:adjust:${id}`, error);
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
      toast.error(apiErrorMessage(error, "Couldn't update the stock. The amount may have just changed; check the new total and try again."));
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
    onError: (error) => {
      toast.error(conflictMessage(error, "Couldn't delete the ingredient. Check the connection and try again."));
    },
  });
}
