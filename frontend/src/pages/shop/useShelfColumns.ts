import { useEffect, useState, type RefObject } from "react";

const PHONE = 520;
const MIN_ITEM = 176;

function columnsFor(width: number): number {
  if (width < PHONE) return 2;
  return Math.min(6, Math.max(3, Math.floor(width / MIN_ITEM)));
}

/**
 * How many donuts fit on one shelf. Knowing it lets the last row be padded
 * with empty glass, so every shelf runs the full width of the case.
 */
export function useShelfColumns(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setColumns(columnsFor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}
