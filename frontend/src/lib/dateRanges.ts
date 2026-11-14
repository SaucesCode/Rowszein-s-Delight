type Preset = "today" | "this_week" | "this_month" | "this_quarter" | "this_year";
export type Period = "today" | "this_week" | "this_month" | "custom";
export type DashboardPeriod = Exclude<Preset, "today"> | "custom";
export type DateRange = { date_from?: string; date_to?: string };

const manilaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const labelFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  weekday: "long",
  month: "short",
  day: "numeric",
});
const businessDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function manilaDate(now = new Date()): string {
  const parts = manilaFormatter.formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

// UTC setters/getters act as a calendar calculator, independent of browser DST.
function calendarDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function calendarString(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateRange(period: Preset, now = new Date()): Required<DateRange> {
  const today = manilaDate(now);
  const from = calendarDay(today);
  switch (period) {
    case "this_week":
      // Weeks start on Monday. Sunday is the last day of that week.
      from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7);
      break;
    case "this_month":
      from.setUTCDate(1);
      break;
    case "this_quarter":
      from.setUTCMonth(Math.floor(from.getUTCMonth() / 3) * 3, 1);
      break;
    case "this_year":
      from.setUTCMonth(0, 1);
      break;
  }
  return { date_from: calendarString(from), date_to: today };
}

/** The whole previous calendar month in Manila, e.g. for paying partners monthly. */
export function getLastMonthRange(now = new Date()): Required<DateRange> {
  const end = calendarDay(manilaDate(now));
  end.setUTCDate(0);
  const start = new Date(end.getTime());
  start.setUTCDate(1);
  return { date_from: calendarString(start), date_to: calendarString(end) };
}

export function customDateRange(from: string, to: string): DateRange {
  return { ...(from && { date_from: from }), ...(to && { date_to: to }) };
}

function isDateOnly(value: string): boolean {
  return value.length === 10 && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)
    && !value.startsWith("0000") && calendarString(calendarDay(value)) === value;
}

export function dateRangeError({ date_from, date_to }: DateRange): string | undefined {
  if (date_from !== undefined && !isDateOnly(date_from)) return "Enter a valid start date.";
  if (date_to !== undefined && !isDateOnly(date_to)) return "Enter a valid end date.";
  if (date_from && date_to && date_from > date_to) return "The end date must be on or after the start date.";
}

export function reportRangeError(range: DateRange, now: Date): string | undefined {
  return dateRangeError({ ...getDateRange("this_year", now), ...range });
}

export function formatDayLabel(value: string, today = manilaDate()): string {
  if (value === today) return "Today";
  const yesterday = calendarDay(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (value === calendarString(yesterday)) return "Yesterday";
  return labelFormatter.format(calendarDay(value));
}

export function formatBusinessDate(value: string): string {
  return businessDateFormatter.format(calendarDay(value));
}

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "custom", label: "Custom" },
];
