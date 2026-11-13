import type { CartItem } from "@/hooks/useCart";
import { formatPeso } from "@/pages/dashboard/report-format";
import { boxPrice, describeBox, type BoxLine } from "./useBoxOrder";

export const SHOP_MESSENGER = "https://m.me/rowszeinsdelight";
export const SHOP_EMAIL = "hello@rowszeinsdelight.com";

const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export const formatOrderTime = (date: Date) => manilaDateTime.format(date);

/** One donut per unit, in box order, for drawing a box that fills up. */
export function boxUnits(items: CartItem[]): CartItem[] {
  return items.flatMap(item => Array.from({ length: item.quantity }, () => item));
}

/**
 * A short label the customer can quote in Messenger, e.g. "RD-1113-4F8K".
 * It is not stored anywhere; the shop confirms orders by replying.
 */
export function cardNumber(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RD-${month}${day}-${random}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "1 box, 3 donuts", "2 boxes" or "1 donut". */
export function orderSummary(boxCount: number, singleCount: number): string {
  const parts = [];
  if (boxCount) parts.push(plural(boxCount, "box", "boxes"));
  if (singleCount || !boxCount) parts.push(plural(singleCount, "donut", "donuts"));
  return parts.join(", ");
}

/** The order as a Messenger message: each box with its contents, then single donuts. */
export function orderText(boxes: BoxLine[], singles: CartItem[], total: number, name: string): string {
  const boxLines = boxes.map(box => `${box.name} (${formatPeso(boxPrice(box))}): ${describeBox(box.donuts)}`);
  const singleLines = singles.map(item => `${item.quantity} × ${item.name} (${formatPeso(item.price * item.quantity)})`);
  return [
    "Hi Rowszein's Delight! I'd like to order:",
    "",
    ...boxLines,
    ...(boxLines.length && singleLines.length ? [""] : []),
    ...singleLines,
    "",
    `Total: ${formatPeso(total)}`,
    ...(name ? [`Name: ${name}`] : []),
  ].join("\n");
}

/** Renders a DOM node to PNG and downloads it. html-to-image loads only when first needed. */
export async function downloadNodeAsPng(node: HTMLElement, filename: string): Promise<void> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
