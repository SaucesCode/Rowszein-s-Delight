export type PaymentMethod = "gcash" | "maya" | "bank_transfer" | "cod";

/** One weekday; 0 is Monday. Times are "HH:MM" in Manila time. */
export interface DeliveryDay {
  weekday: number;
  is_open: boolean;
  opens: string | null;
  closes: string | null;
}

export interface DayOff {
  starts: string;
  ends: string;
  note: string;
}

export interface Contact {
  messenger_url: string;
  facebook_url: string;
  email: string;
  phone: string;
}

interface SettingsBase extends Contact {
  notice: string;
  orders_paused: boolean;
  pause_message: string;
  lead_days: number;
  order_cutoff: string | null;
  payment_methods: PaymentMethod[];
  days_off: DayOff[];
}

/** A meet-up spot with its own week of hours (seven rows, 0 is Monday). */
export interface MeetupPlace {
  id: number;
  name: string;
  note: string;
  hours: DeliveryDay[];
}

export interface ManagedMeetupPlace {
  id?: number;
  name: string;
  note: string;
  is_active: boolean;
  hours: DeliveryDay[];
}

/** What the public shop reads. `hours` is empty while the owner keeps them hidden. */
export interface PublicShopSettings extends SettingsBase {
  hours: DeliveryDay[];
  /** Active meet-up places only. */
  meetup_places: MeetupPlace[];
  /** A null fee means it's confirmed when the shop replies. */
  towns: { id: number; name: string; fee: string | null }[];
}

export interface ManagedTown {
  id?: number;
  name: string;
  is_active: boolean;
  fee: string | null;
}

/** The owner's Shop settings page. `hours` always has seven rows. */
export interface ManagedShopSettings extends SettingsBase {
  /** Private: where new-order emails go. Never in the public settings. */
  order_email: string;
  show_hours: boolean;
  revision: number;
  updated_at: string;
  hours: DeliveryDay[];
  towns: ManagedTown[];
  meetup_places: ManagedMeetupPlace[];
}

export type ShopSettingsPayload = Omit<ManagedShopSettings, "updated_at">;
