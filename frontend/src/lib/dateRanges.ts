export type Period = "today" | "this_week" | "this_month" | "custom";

const fmt = (d: Date) => d.toISOString().split("T")[0];

/**
 * Returns { date_from, date_to } for a given period, both as YYYY-MM-DD.
 * "custom" is intentionally not handled here — the caller manages its own
 * date_from/date_to state in that case (see DateRangeFilter usage).
 */
export function getDateRange(period: Exclude<Period, "custom">): {
  date_from: string;
  date_to: string;
} {
  const today = new Date();

  switch (period) {
    case "today":
      return { date_from: fmt(today), date_to: fmt(today) };

    case "this_week": {
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { date_from: fmt(monday), date_to: fmt(today) };
    }

    case "this_month": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
  }
}

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "custom", label: "Custom" },
];