import type { CartItem } from "@/hooks/useCart";
import { formatPeso } from "@/pages/dashboard/report-format";

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

export function orderText(items: CartItem[], total: number, name: string): string {
  const lines = items.map(item => `${item.quantity} × ${item.name} (${formatPeso(item.price * item.quantity)})`);
  return [
    "Hi Rowszein's Delight! I'd like to order:",
    "",
    ...lines,
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
