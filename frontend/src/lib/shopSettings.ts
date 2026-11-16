/** Turns the owner's Shop settings into what customers read. Pure; no React. */
import { formatPeso } from "../pages/dashboard/report-format.ts";
import type { Contact, DayOff, DeliveryDay, PaymentMethod, PublicShopSettings } from "@/types/shopSettings.types";

/** Used only while settings load, or if they fail to load. */
export const DEFAULT_CONTACT: Contact = {
  messenger_url: "https://m.me/rowszeinsdelight",
  email: "hello@rowszeinsdelight.com",
  facebook_url: "",
  phone: "",
};

export const DEFAULT_PAUSE_MESSAGE = "We're not taking orders right now. Message us on Messenger for anything urgent.";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  cod: "Cash on delivery",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Once settings load they are the truth: a blank email or phone stays blank and its link hides. */
export function shopContact(settings?: PublicShopSettings): Contact {
  if (!settings) return DEFAULT_CONTACT;
  const { messenger_url, facebook_url, email, phone } = settings;
  return { messenger_url, facebook_url, email, phone };
}

export function formatTime(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

const dayTime = (day: DeliveryDay) =>
  day.is_open && day.opens && day.closes ? `${formatTime(day.opens)}–${formatTime(day.closes)}` : "Closed";

/**
 * Consecutive days with the same hours, Monday to Sunday: "Tue–Sun · 9:00 AM–6:00 PM".
 * Null when the owner keeps hours hidden; empty when every day is closed.
 */
export function groupHours(hours: DeliveryDay[]): { days: string; time: string }[] | null {
  if (!hours.length) return null;
  const week = [...hours].sort((a, b) => a.weekday - b.weekday);
  if (week.every(day => !day.is_open)) return [];
  const groups: { first: number; last: number; time: string }[] = [];
  for (const day of week) {
    const time = dayTime(day);
    const previous = groups[groups.length - 1];
    if (previous && previous.time === time && previous.last === day.weekday - 1) previous.last = day.weekday;
    else groups.push({ first: day.weekday, last: day.weekday, time });
  }
  return groups.map(({ first, last, time }) => ({
    days: first === last ? WEEKDAYS[first] : `${WEEKDAYS[first]}–${WEEKDAYS[last]}`,
    time,
  }));
}

export function cutoffSentence(leadDays: number, cutoff: string | null): string {
  const by = cutoff ? `Order by ${formatTime(cutoff)}` : null;
  if (leadDays === 0) return by ? `${by} for same-day delivery.` : "Order today for same-day delivery.";
  if (leadDays === 1) return by ? `${by} for next-day delivery.` : "Order a day ahead.";
  return by ? `${by}, ${leadDays} days before delivery.` : `Order ${leadDays} days ahead.`;
}

export function feeLabel(fee: string | null): string {
  if (fee === null) return "Fee confirmed when we reply";
  const amount = Number(fee);
  return amount === 0 ? "Free delivery" : `${formatPeso(amount)} delivery`;
}

/** Dates are read as calendar days ("2026-11-30"), never through a time zone. */
const parts = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: MONTHS[month - 1], day };
};

export function dayOffLabel({ starts, ends, note }: DayOff): string {
  const from = parts(starts);
  const to = parts(ends);
  let range: string;
  if (starts === ends) range = `${from.month} ${from.day}`;
  else if (from.month === to.month && from.year === to.year) range = `${from.month} ${from.day}–${to.day}`;
  else range = `${from.month} ${from.day} – ${to.month} ${to.day}`;
  return note ? `${range} · ${note}` : range;
}

/** "Lucena City, Tayabas and Sariaya". */
export function listNames(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
