import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { saleService } from "@/services/sale.service";
import type { SaleFilters } from "@/services/sale.service";
import type { SalePayload } from "@/types/sale.types";
import toast from "react-hot-toast";
import { useOperationIdentity } from "@/hooks/useOperationIdentity";
import { apiErrorMessage } from "@/lib/csrfTransport";

export function useSalesSummary(filters: SaleFilters = {}, enabled = true) {
  return useQuery({ queryKey: ["sales", "summary", filters], queryFn: () => saleService.financialSummary(filters), enabled });
}

export function useSales(filters: SaleFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["sales", filters],
    queryFn: () => saleService.getAll(filters),
    enabled,
  });
}

export function useSale(id: number) {
  return useQuery({
    queryKey: ["sales", id],
    queryFn: () => saleService.getOne(id),
    enabled: !!id,
  });
}

/** Records a sale and stays put: the register clears for the next customer. */
export function useCreateSale() {
  const queryClient = useQueryClient();
  const identity = useOperationIdentity();

  return useMutation({
    mutationFn: (payload: SalePayload) => saleService.create(payload, identity.get("sale:create").key),
    onSuccess: () => {
      identity.clear("sale:create");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      identity.reject("sale:create", error);
      toast.error(apiErrorMessage(error, "Couldn't record the sale. Check the connection and try again; it won't be counted twice."));
    },
  });
}

export function useUpdateSale(id: number, revision?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const identity = useOperationIdentity();

  return useMutation({
    mutationFn: (payload: SalePayload) => {
      if (revision === undefined) throw new Error("Reload this sale before updating.");
      const operation = identity.get(`sale:update:${id}`, revision);
      return saleService.update(id, payload, operation.key, operation.revision!);
    },
    onSuccess: () => {
      identity.clear(`sale:update:${id}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Sale updated.");
      navigate("/sales");
    },
    onError: (error) => {
      identity.reject(`sale:update:${id}`, error);
      queryClient.invalidateQueries({ queryKey: ["sales", id] });
      toast.error(apiErrorMessage(error, "Couldn't save the changes. Someone may have changed this sale; reload it and try again."));
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  const identity = useOperationIdentity();

  return useMutation({
    mutationFn: ({ id, revision, reason }: { id: number; revision: string; reason: string }) => {
      const operation = identity.get(`sale:cancel:${id}`, revision);
      return saleService.delete(id, reason, operation.key, operation.revision!);
    },
    onSuccess: (_data, variables) => {
      identity.clear(`sale:cancel:${variables.id}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Sale cancelled. Its donuts are back in stock; no cash refund was recorded.");
    },
    onError: (error, variables) => {
      identity.reject(`sale:cancel:${variables.id}`, error);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.error(apiErrorMessage(error, "Couldn't cancel the sale. It may have just changed; reload and try again."));
    },
  });
}
