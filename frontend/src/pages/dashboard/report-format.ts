import type { ChartMonth, PesoValue } from "@/services/dashboard.service";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" });
const quantity = new Intl.NumberFormat("en-PH");
const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en-PH", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 });

export const formatPeso = (value: PesoValue) => peso.format(value);
export const formatUnits = (value: number) => quantity.format(value);
export const formatAxisPeso = (value: number) => `${value < 0 ? "−" : ""}₱${compact.format(Math.abs(value))}`;

export function monthComparison(rows: ChartMonth[], monthIndex: number, key: "sales" | "expenses" | "profit") {
  const current = rows[monthIndex];
  const previous = rows[monthIndex - 1];
  if (!current || !previous?.[key]) return;
  const change = (current[key] - previous[key]) / Math.abs(previous[key]);
  return `${percent.format(change)} · ${current.month} to date vs ${previous.month}`;
}

export function stockLabel(value: string, unit: string) {
  const exact = value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return `${exact} ${unit}`;
}
