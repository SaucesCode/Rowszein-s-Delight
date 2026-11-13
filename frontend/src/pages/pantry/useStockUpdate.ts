import { useId, useState, type FormEvent } from "react";
import { useUpdateStock } from "@/hooks/useIngredients";
import { stockQuanta, stockText } from "@/lib/stockQuantity";
import { formatAmount } from "@/lib/stockStatus";
import type { Ingredient } from "@/types/ingredient.types";

export type Direction = "in" | "out";

export const REASONS: Record<Direction, string[]> = {
  in: ["Supplier delivery", "Bought at the market", "Stock count correction"],
  out: ["Used in baking", "Spoiled or expired", "Stock count correction"],
};

interface Preview {
  delta: string;
  total: string | null;
  amountError: string | null;
}

/** Exact-decimal preview of the change; mirrors the server's own checks so errors show before saving. */
function preview(current: string, amount: string, direction: Direction, currentText: string): Preview {
  if (!amount.trim()) return { delta: "", total: null, amountError: "Enter how much." };
  try {
    const magnitude = stockQuanta(amount.trim());
    if (magnitude <= 0n) return { delta: "", total: null, amountError: "Enter an amount more than 0." };
    const change = direction === "in" ? magnitude : -magnitude;
    const projected = stockQuanta(current) + change;
    if (projected < 0n) return { delta: "", total: null, amountError: `That's more than you have (${currentText}).` };
    const total = stockText(projected);
    stockQuanta(total);
    return { delta: stockText(change), total, amountError: null };
  } catch {
    return { delta: "", total: null, amountError: "Use a plain number, like 2 or 2.5." };
  }
}

export function stepped(amount: string, step: number): string {
  const next = Math.max(0, (Number(amount) || 0) + step);
  return String(Math.round(next * 1000) / 1000);
}

/**
 * State for the Update stock panel. The form body and its Save bar render
 * separately (StockForm / StockFoot) so the bar can sit outside the scrolling
 * area and stay on screen; the button joins the form through its id.
 */
export function useStockUpdate(ingredient: Ingredient) {
  const formId = useId();
  const [direction, setDirection] = useState<Direction>("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const updateStock = useUpdateStock(ingredient.id);

  const current = String(ingredient.quantity);
  const result = preview(current, amount, direction, formatAmount(current, ingredient.unit));
  const reasonError = reason.trim() ? null : "Pick or type a reason.";

  const switchDirection = (next: Direction) => {
    if (REASONS[direction].includes(reason)) setReason("");
    setDirection(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (result.amountError || reasonError || updateStock.isPending) return;
    const verb = direction === "in" ? "added" : "taken out";
    updateStock.mutate(
      {
        delta: result.delta,
        reason: reason.trim(),
        revision: ingredient.stock_revision,
        successMessage: `${ingredient.name}: ${formatAmount(amount, ingredient.unit)} ${verb}. Now ${formatAmount(result.total!, ingredient.unit)}.`,
      },
      {
        onSuccess: () => {
          setAmount("");
          setReason("");
          setShowErrors(false);
        },
      },
    );
  };

  return {
    ingredient,
    formId,
    direction,
    switchDirection,
    amount,
    setAmount,
    reason,
    setReason,
    showErrors,
    result,
    reasonError,
    submit,
    saving: updateStock.isPending,
  };
}

export type StockUpdate = ReturnType<typeof useStockUpdate>;
