import { useCallback, useEffect, useState } from "react";
import { fillEvenly } from "../../lib/boxRule.ts";
import type { Product } from "@/types/product.types";
import type { ShopBoxes } from "@/types/box.types";

/** One donut in one slot of a box. */
export interface BoxDonut {
  product_id: number;
  name: string;
  category?: string;
  image_url: string | null;
  box_extra: number;
}

/** A box in the customer's order. */
export interface BoxLine {
  key: string;
  name: string;
  size: number;
  boxPrice: number;
  donuts: BoxDonut[];
  assortmentId?: number;
}

/** The box the customer is filling right now: the flavours picked, in pick order. */
export interface FillingBox {
  size: number;
  boxPrice: number;
  maxFlavors: number;
  flavours: BoxDonut[];
}

interface BoxOrder {
  filling: FillingBox | null;
  boxes: BoxLine[];
}

const STORAGE_KEY = "rowszein_box_order";
const EMPTY: BoxOrder = { filling: null, boxes: [] };

/** A stored order; a half-filled box saved before the flavour rule is dropped, finished boxes are kept. */
export function parseStoredOrder(raw: string | null): BoxOrder {
  try {
    const parsed = raw ? (JSON.parse(raw) as BoxOrder) : EMPTY;
    if (!Array.isArray(parsed?.boxes)) return EMPTY;
    const filling = parsed.filling && Array.isArray(parsed.filling.flavours) ? parsed.filling : null;
    return { filling, boxes: parsed.boxes };
  } catch {
    // Unreadable stored order: start empty rather than fail.
    return EMPTY;
  }
}

function load(): BoxOrder {
  try {
    return parseStoredOrder(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    // Blocked storage: start with an empty order rather than fail.
    return EMPTY;
  }
}

/** Boxes are donut-only: a collab partner's muffin or cake is sold on its own. */
export const canGoInBox = (product: Pick<Product, "partner">) => !product.partner;

export const boxPrice = (box: { boxPrice: number; donuts: BoxDonut[] }) =>
  box.boxPrice + box.donuts.reduce((sum, donut) => sum + donut.box_extra, 0);

export const donutFrom = (product: Product): BoxDonut => ({
  product_id: product.id,
  name: product.name,
  category: product.category?.name,
  image_url: product.image_url,
  box_extra: Number(product.box_extra ?? 0),
});

/** Every slot of the box being filled: its flavours filled evenly. */
export const fillingDonuts = (box: FillingBox): BoxDonut[] =>
  fillEvenly(box.size, box.flavours).flatMap(({ item, quantity }) => Array.from({ length: quantity }, () => item));

/** Pick a flavour, or take it out if it's already picked. */
export function toggleFillingFlavour(box: FillingBox, product: Product): FillingBox | { error: string } {
  if (box.flavours.some(flavour => flavour.product_id === product.id)) {
    return { ...box, flavours: box.flavours.filter(flavour => flavour.product_id !== product.id) };
  }
  if (!canGoInBox(product)) return { error: "Not in boxes" };
  if (box.flavours.length >= box.maxFlavors) return { error: `This box takes up to ${box.maxFlavors} flavours` };
  return { ...box, flavours: [...box.flavours, donutFrom(product)] };
}

/** Groups a box's slots into "4 Glazed, 3 Ube" for summaries and the order card. */
export function describeBox(donuts: BoxDonut[]): string {
  const counts = new Map<string, number>();
  for (const donut of donuts) counts.set(donut.name, (counts.get(donut.name) ?? 0) + 1);
  return [...counts].map(([name, count]) => `${count} ${name}`).join(", ");
}

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function useBoxOrder() {
  const [order, setOrder] = useState<BoxOrder>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch {
      // Private browsing or full storage: the order still works for this visit.
    }
  }, [order]);

  const startBox = useCallback((size: number, price: number, maxFlavors: number) => {
    setOrder(current => ({ ...current, filling: { size, boxPrice: price, maxFlavors, flavours: [] } }));
  }, []);

  const cancelBox = useCallback(() => setOrder(current => ({ ...current, filling: null })), []);

  /** Picks or unpicks a flavour; ignored when no box is open or the pick isn't allowed. */
  const toggleInBox = useCallback((product: Product) => {
    setOrder(current => {
      if (!current.filling) return current;
      const next = toggleFillingFlavour(current.filling, product);
      return "error" in next ? current : { ...current, filling: next };
    });
  }, []);

  const unpickLast = useCallback(() => {
    setOrder(current =>
      current.filling ? { ...current, filling: { ...current.filling, flavours: current.filling.flavours.slice(0, -1) } } : current,
    );
  }, []);

  const finishBox = useCallback(() => {
    setOrder(current => {
      const filling = current.filling;
      if (!filling || filling.flavours.length === 0) return current;
      const line: BoxLine = { key: newKey(), name: `Box of ${filling.size}`, size: filling.size, boxPrice: filling.boxPrice, donuts: fillingDonuts(filling) };
      return { filling: null, boxes: [...current.boxes, line] };
    });
  }, []);

  const addReadyMade = useCallback((assortment: ShopBoxes["assortments"][number], sizePrice: number) => {
    const donuts = assortment.items.flatMap(item =>
      Array.from({ length: item.quantity }, () => ({
        product_id: item.product_id,
        name: item.name,
        category: item.category,
        image_url: item.image_url,
        box_extra: Number(item.box_extra),
      })),
    );
    const line: BoxLine = { key: newKey(), name: assortment.name, size: assortment.size, boxPrice: sizePrice, donuts, assortmentId: assortment.id };
    setOrder(current => ({ ...current, boxes: [...current.boxes, line] }));
  }, []);

  const removeBox = useCallback((key: string) => {
    setOrder(current => ({ ...current, boxes: current.boxes.filter(box => box.key !== key) }));
  }, []);

  const clearBoxes = useCallback(() => setOrder(current => ({ ...current, boxes: [] })), []);
  const restoreBoxes = useCallback((boxes: BoxLine[]) => setOrder(current => ({ ...current, boxes })), []);

  return {
    filling: order.filling,
    boxes: order.boxes,
    boxesTotal: order.boxes.reduce((sum, box) => sum + boxPrice(box), 0),
    startBox,
    cancelBox,
    toggleInBox,
    unpickLast,
    finishBox,
    addReadyMade,
    removeBox,
    clearBoxes,
    restoreBoxes,
  };
}
