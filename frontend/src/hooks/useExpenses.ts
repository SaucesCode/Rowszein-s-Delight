import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { expenseService } from "@/services/expense.service";
import type { ExpensePayload } from "@/types/expense.types";
import toast from "react-hot-toast";

export function useExpenses(page = 1) {
  return useQuery({
    queryKey: ["expenses", page],
    queryFn: () => expenseService.getAll(page),
  });
}

export function useExpense(id: number) {
  return useQuery({
    queryKey: ["expenses", id],
    queryFn: () => expenseService.getOne(id),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: ExpensePayload) => expenseService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense recorded.");
      navigate("/expenses");
    },
    onError: () => {
      toast.error("Failed to record expense.");
    },
  });
}

export function useUpdateExpense(id: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: ExpensePayload) => expenseService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense updated.");
      navigate("/expenses");
    },
    onError: () => {
      toast.error("Failed to update expense.");
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => expenseService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted.");
    },
    onError: () => {
      toast.error("Failed to delete expense.");
    },
  });
}
