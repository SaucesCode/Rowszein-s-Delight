import axios from "axios";
import type { OrderFilter, OrderStatus } from "@/types/order.types";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  waiting: "Waiting",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "waiting", label: "Waiting" },
  { value: "confirmed", label: "Confirmed" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All" },
];

export const PAYMENT_NAMES: Record<string, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  cod: "Cash on delivery",
};

/** The first readable message in a refused confirm or decline (the sales command answers in several shapes). */
export function actionMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const detail: unknown = error.response?.data?.error;
  const first = (value: unknown): string | null => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(first).find(Boolean) ?? null;
    if (value && typeof value === "object") return Object.values(value).map(first).find(Boolean) ?? null;
    return null;
  };
  return first(detail) ?? fallback;
}
