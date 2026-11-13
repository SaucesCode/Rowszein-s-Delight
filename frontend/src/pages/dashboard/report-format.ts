import type { PesoValue } from "@/services/dashboard.service";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" });
const quantity = new Intl.NumberFormat("en-PH");
const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

export const formatPeso = (value: PesoValue) => peso.format(value);
export const formatUnits = (value: number) => quantity.format(value);
export const formatAxisPeso = (value: number) => `${value < 0 ? "−" : ""}₱${compact.format(Math.abs(value))}`;
