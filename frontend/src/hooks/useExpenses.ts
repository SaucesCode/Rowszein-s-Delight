import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { expenseService } from "@/services/expense.service";
import type { ExpenseFilters } from "@/services/expense.service";
import type { Expense, ExpensePayload } from "@/types/expense.types";
import toast from "react-hot-toast";

export function useExpenses(filters: ExpenseFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: () => expenseService.getAll(filters),
    enabled,
  });
}

export const EXPENSE_PAGE_LIMIT = 10;

/**
 * Every expense in a date range, across pages, so category totals are true
 * for the whole period rather than one page. Capped at EXPENSE_PAGE_LIMIT
 * pages (200 expenses); `complete` says whether the cap was hit.
 */
export function useExpensesInRange(range: { date_from?: string; date_to?: string }, enabled = true) {
  return useQuery({
    queryKey: ["expenses", "range", range],
    queryFn: async () => {
      const expenses: Expense[] = [];
      for (let page = 1; page <= EXPENSE_PAGE_LIMIT; page += 1) {
        const listing = await expenseService.getAll({ ...range, page });
        expenses.push(...listing.data.results);
        if (!listing.data.next) return { expenses, complete: true };
      }
      return { expenses, complete: false };
    },
    enabled,
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense logged.");
      navigate("/expenses");
    },
    onError: () => {
      toast.error("Couldn't log the expense. Check the connection and try again.");
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Changes saved.");
      navigate("/expenses");
    },
    onError: () => {
      toast.error("Couldn't save the changes. Check the connection and try again.");
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => expenseService.delete(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["expenses", id], exact: true });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense deleted.");
    },
    onError: () => {
      toast.error("Couldn't delete the expense. Check the connection and try again.");
    },
  });
}
