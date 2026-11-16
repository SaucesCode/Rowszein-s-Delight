/**
 * The shop's checkout rules, mirrored from the server so customers only see days and answers it will
 * accept. The server checks everything again; these only keep customers from hitting avoidable errors.
 */
import type { CartItem } from "@/hooks/useCart";
import type { BoxLine } from "@/pages/shop/useBoxOrder";
import type { MeetupPlace, PublicShopSettings } from "@/types/shopSettings.types";

export type CheckoutField =
  | "customer_name" | "phone" | "town" | "address" | "delivery_date" | "payment_method" | "note" | "meetup_place" | "meetup_time";
/** Every field is a string as the inputs hold it; `fulfilment` is "delivery" or "meetup". */
export type CheckoutForm = Record<CheckoutField, string> & { fulfilment: "delivery" | "meetup" };

export const PHONE_MESSAGE = "Enter a mobile number like 0917 123 4567.";
const MAX_DAYS_AHEAD = 30;
const LAST_ORDER_KEY = "rowszein-last-order";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const manilaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Today's Manila date as a UTC-midnight calendar day, plus the Manila time of day in seconds. */
function manilaNow(now: Date): { day: Date; seconds: number } {
  const parts = Object.fromEntries(manilaParts.formatToParts(now).map(part => [part.type, part.value]));
  return {
    day: new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))),
    seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

const iso = (day: Date) => day.toISOString().slice(0, 10);
const addDays = (day: Date, count: number) => new Date(day.getTime() + count * 86_400_000);
const hhmmSeconds = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60;
};

function earliestDay(settings: PublicShopSettings, now: Date): Date {
  const { day: today, seconds } = manilaNow(now);
  const earliest = addDays(today, settings.lead_days);
  return settings.order_cutoff && seconds > hhmmSeconds(settings.order_cutoff) ? addDays(earliest, 1) : earliest;
}

const isDayOff = (settings: PublicShopSettings, date: string) => settings.days_off.some(off => off.starts <= date && date <= off.ends);

/** The next `count` days the shop delivers, as YYYY-MM-DD, by the same rules as the server. */
export function allowedDeliveryDates(settings: PublicShopSettings, now: Date, count = 14): string[] {
  const earliest = earliestDay(settings, now);
  // Hours are only sent while the owner shows them; then closed weekdays are skipped. 0 is Monday.
  const closed = new Set(settings.hours.filter(day => !day.is_open).map(day => day.weekday));
  const days: string[] = [];
  for (let offset = 0; offset <= MAX_DAYS_AHEAD && days.length < count; offset++) {
    const day = addDays(earliest, offset);
    const date = iso(day);
    if (closed.has((day.getUTCDay() + 6) % 7)) continue;
    if (isDayOff(settings, date)) continue;
    days.push(date);
  }
  return days;
}

const STEP = 30;
const NOTICE = 60;
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** A place's meet-up times on a day ("HH:MM"): every 30 minutes until half an hour before closing; today, an hour ahead. */
export function meetupTimes(place: MeetupPlace, date: string, now: Date): string[] {
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay() + 6) % 7;
  const hours = place.hours.find(row => row.weekday === weekday);
  if (!hours?.is_open || !hours.opens || !hours.closes) return [];
  const last = hhmmSeconds(hours.closes) / 60 - STEP;
  const { day: today, seconds } = manilaNow(now);
  const soonest = iso(today) === date ? Math.ceil(seconds / 60) + NOTICE : 0;
  const times: string[] = [];
  for (let minute = hhmmSeconds(hours.opens) / 60; minute <= last; minute += STEP) {
    if (minute >= soonest) times.push(clock(minute));
  }
  return times;
}

/** The next `count` days a meet-up place has a time left, by the same rules as the server. */
export function allowedMeetupDates(settings: PublicShopSettings, place: MeetupPlace, now: Date, count = 14): string[] {
  const earliest = earliestDay(settings, now);
  const days: string[] = [];
  for (let offset = 0; offset <= MAX_DAYS_AHEAD && days.length < count; offset++) {
    const date = iso(addDays(earliest, offset));
    if (!isDayOff(settings, date) && meetupTimes(place, date, now).length) days.push(date);
  }
  return days;
}

/** Active places that still have at least one day to offer. */
export function offerablePlaces(settings: PublicShopSettings, now: Date): MeetupPlace[] {
  return settings.meetup_places.filter(place => allowedMeetupDates(settings, place, now, 1).length > 0);
}

/** "Wed, Nov 18". */
export function deliveryDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${MONTHS[month - 1]} ${day}`;
}

/** A Philippine mobile number as +639XXXXXXXXX, or null. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s().-]/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^\+?639\d{9}$/.test(digits)) return `+${digits.replace(/^\+/, "")}`;
  return null;
}

/** "+639171234567" as people write it: "0917 123 4567". Anything else is shown as given. */
export function displayPhone(stored: string): string {
  const phone = normalisePhone(stored);
  if (!phone) return stored;
  const local = `0${phone.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

const MARKUP = /[<>]/;

export function checkoutErrors(form: CheckoutForm, settings: PublicShopSettings, now: Date): Partial<Record<CheckoutField, string>> {
  const errors: Partial<Record<CheckoutField, string>> = {};
  const name = form.customer_name.trim();
  if (!name) errors.customer_name = "Enter your name.";
  else if (name.length > 80) errors.customer_name = "Keep your name under 80 characters.";
  else if (MARKUP.test(name)) errors.customer_name = "Leave out the < and > characters.";
  if (!normalisePhone(form.phone)) errors.phone = PHONE_MESSAGE;
  if (form.fulfilment === "meetup") {
    const place = offerablePlaces(settings, now).find(option => String(option.id) === form.meetup_place);
    if (!place) errors.meetup_place = "Pick where to meet.";
    if (!place || !allowedMeetupDates(settings, place, now, MAX_DAYS_AHEAD + 1).includes(form.delivery_date)) {
      errors.delivery_date = "Pick a day.";
    }
    if (!place || !meetupTimes(place, form.delivery_date, now).includes(form.meetup_time)) errors.meetup_time = "Pick a time.";
  } else {
    if (!form.town) errors.town = "Pick your town.";
    const address = form.address.trim();
    if (!address) errors.address = "Enter your street address and a landmark.";
    else if (address.length > 200) errors.address = "Keep the address under 200 characters.";
    else if (MARKUP.test(address)) errors.address = "Leave out the < and > characters.";
    if (!allowedDeliveryDates(settings, now, MAX_DAYS_AHEAD + 1).includes(form.delivery_date)) {
      errors.delivery_date = "Pick a delivery day.";
    }
  }
  if (settings.payment_methods.length && !settings.payment_methods.includes(form.payment_method as never)) {
    errors.payment_method = "Pick how you'd like to pay.";
  }
  if (form.note.length > 300) errors.note = "Keep the note under 300 characters.";
  else if (MARKUP.test(form.note)) errors.note = "Leave out the < and > characters.";
  return errors;
}

/** What the server needs: products, boxes and quantities. It prices everything itself. */
export function orderPayload(cart: CartItem[], boxes: BoxLine[], sizes: { id: number; size: number }[], form: CheckoutForm, clientKey: string) {
  const meetup = form.fulfilment === "meetup";
  return {
    client_key: clientKey,
    customer_name: form.customer_name.trim(),
    phone: form.phone.trim(),
    address: meetup ? "" : form.address.trim(),
    note: form.note.trim(),
    town: meetup ? null : Number(form.town),
    delivery_date: form.delivery_date,
    payment_method: form.payment_method,
    website: "",
    fulfilment: form.fulfilment,
    meetup_place: meetup ? Number(form.meetup_place) : null,
    meetup_time: meetup ? form.meetup_time : null,
    items: cart.map(item => ({ product: item.product_id, quantity: item.quantity })),
    boxes: boxes.map(box => {
      if (box.assortmentId) return { assortment: box.assortmentId };
      const counts = new Map<number, number>();
      for (const donut of box.donuts) counts.set(donut.product_id, (counts.get(donut.product_id) ?? 0) + 1);
      return {
        box_size: sizes.find(size => size.size === box.size)?.id ?? 0,
        contents: [...counts].map(([product, quantity]) => ({ product, quantity })),
      };
    }),
  };
}

export interface LastOrder {
  number: string;
  token: string;
}

export function rememberLastOrder(order: LastOrder): void {
  try {
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Storage blocked: the confirmation screen still shows the link; it just isn't remembered.
  }
}

export function lastOrder(): LastOrder | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) ?? "null");
    return saved && typeof saved.number === "string" && typeof saved.token === "string" ? saved : null;
  } catch {
    return null;
  }
}
