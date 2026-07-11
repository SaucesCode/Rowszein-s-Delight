export interface DayGroup<T> {
  date: string;
  items: T[];
  subtotal: number;
}

/**
 * Groups records by their `date` field, in the order given (the API already
 * returns newest-first). Generalized from SalesPage's groupByDay so other
 * date-driven, page-scoped lists (Expenses, and later Sales itself) can
 * share one implementation instead of drifting.
 *
 * Page-local like the original: a day split across two pages of results
 * shows as two groups. Acceptable at 20-per-page; revisit with a "group by
 * day" backend endpoint if this becomes a real pain point.
 */
export function groupByDay<T extends { date: string }>(
  records: T[],
  getAmount: (record: T) => number,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];

  for (const record of records) {
    const existing = groups.find(g => g.date === record.date);
    if (existing) {
      existing.items.push(record);
      existing.subtotal += getAmount(record);
    } else {
      groups.push({ date: record.date, items: [record], subtotal: getAmount(record) });
    }
  }

  return groups;
}

export function formatDayLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" });
}
