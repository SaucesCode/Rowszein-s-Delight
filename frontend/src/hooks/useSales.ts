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

export function useSales(filters: SaleFilters = {}) {
  return useQuery({
    queryKey: ["sales", filters],
    queryFn: () => saleService.getAll(filters),
  });
}

export function useSale(id: number) {
  return useQuery({
    queryKey: ["sales", id],
    queryFn: () => saleService.getOne(id),
    enabled: !!id,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const identity = useOperationIdentity();

  return useMutation({
    mutationFn: (payload: SalePayload) => saleService.create(payload, identity.get("sale:create").key),
    onSuccess: () => {
      identity.clear("sale:create");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Sale recorded.");
      navigate("/sales");
    },
    onError: (error) => {
      identity.reject("sale:create", error);
      toast.error(apiErrorMessage(error, "Failed to record sale."));
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
      toast.error(apiErrorMessage(error, "Failed to update sale."));
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
      toast.success("Sale cancelled. No cash refund was recorded.");
    },
    onError: (error, variables) => {
      identity.reject(`sale:cancel:${variables.id}`, error);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.error(apiErrorMessage(error, "Failed to cancel sale. Reload before retrying stale data."));
    },
  });
}
