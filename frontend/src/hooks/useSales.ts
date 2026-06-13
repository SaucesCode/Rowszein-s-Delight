import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { saleService } from "@/services/sale.service";
import type { SalePayload } from "@/types/sale.types";
import toast from "react-hot-toast";

export function useSales(page = 1) {
  return useQuery({
    queryKey: ["sales", page],
    queryFn: () => saleService.getAll(page),
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

  return useMutation({
    mutationFn: (payload: SalePayload) => saleService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Sale recorded.");
      navigate("/sales");
    },
    onError: () => {
      toast.error("Failed to record sale.");
    },
  });
}

export function useUpdateSale(id: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: SalePayload) => saleService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Sale updated.");
      navigate("/sales");
    },
    onError: () => {
      toast.error("Failed to update sale.");
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => saleService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Sale deleted.");
    },
    onError: () => {
      toast.error("Failed to delete sale.");
    },
  });
}
