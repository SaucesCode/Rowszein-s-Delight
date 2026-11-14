import { formatPeso } from "../dashboard/report-format.ts";

/** "Still to pay ₱1,350.00", or "Paid ahead ₱200.00" when the balance is negative. */
export function balanceLabel(stillToPay: string): { label: string; tone: "owed" | "ahead" | "settled" } {
  const value = Number(stillToPay);
  if (value > 0) return { label: `Still to pay ${formatPeso(value)}`, tone: "owed" };
  if (value < 0) return { label: `Paid ahead ${formatPeso(-value)}`, tone: "ahead" };
  return { label: "All paid", tone: "settled" };
}
