/** The Shop settings form's editable copy: blank strings stand in for "none", and list rows carry a React key. */
import type { DeliveryDay, ManagedShopSettings, ShopSettingsPayload } from "@/types/shopSettings.types";

export interface DraftTown {
  key: string;
  id?: number;
  name: string;
  is_active: boolean;
  /** "" while the owner hasn't decided the fee. */
  fee: string;
}

export interface DraftDayOff {
  key: string;
  starts: string;
  ends: string;
  note: string;
}

export interface DraftDay {
  weekday: number;
  is_open: boolean;
  opens: string;
  closes: string;
}

export interface Draft extends Omit<ShopSettingsPayload, "hours" | "towns" | "days_off" | "order_cutoff"> {
  order_cutoff: string;
  hours: DraftDay[];
  towns: DraftTown[];
  days_off: DraftDayOff[];
}

let nextKey = 0;
export const rowKey = () => `row-${++nextKey}`;

export function toDraft(doc: ManagedShopSettings): Draft {
  return {
    ...doc,
    order_cutoff: doc.order_cutoff ?? "",
    hours: doc.hours.map(day => ({ ...day, opens: day.opens ?? "", closes: day.closes ?? "" })),
    towns: doc.towns.map(town => ({ ...town, key: rowKey(), fee: town.fee ?? "" })),
    days_off: doc.days_off.map(day => ({ ...day, key: rowKey() })),
  };
}

/** A typed fee becomes money ("0" → "0.00"); anything unreadable goes as typed so the server can say what's wrong. */
function feeValue(fee: string): string | null {
  const trimmed = fee.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount.toFixed(2) : trimmed;
}

const hoursValue = (day: DraftDay): DeliveryDay => ({
  weekday: day.weekday,
  is_open: day.is_open,
  opens: day.opens || null,
  closes: day.closes || null,
});

export function toPayload(draft: Draft): ShopSettingsPayload {
  return {
    revision: draft.revision,
    show_hours: draft.show_hours,
    orders_paused: draft.orders_paused,
    lead_days: draft.lead_days,
    payment_methods: draft.payment_methods,
    messenger_url: draft.messenger_url.trim(),
    facebook_url: draft.facebook_url.trim(),
    email: draft.email.trim(),
    order_email: draft.order_email.trim(),
    phone: draft.phone.trim(),
    notice: draft.notice.trim(),
    pause_message: draft.pause_message.trim(),
    order_cutoff: draft.order_cutoff || null,
    hours: draft.hours.map(hoursValue),
    towns: draft.towns.map(town => ({
      ...(town.id === undefined ? {} : { id: town.id }),
      name: town.name.trim(),
      is_active: town.is_active,
      fee: feeValue(town.fee),
    })),
    days_off: draft.days_off.map(({ starts, ends, note }) => ({ starts, ends, note: note.trim() })),
  };
}

export function isDirty(draft: Draft, saved: Draft): boolean {
  return JSON.stringify(toPayload(draft)) !== JSON.stringify(toPayload(saved));
}
