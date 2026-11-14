import { useCallback, useEffect, useState } from "react";
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

/** The box the customer is filling from the case right now. */
export interface FillingBox {
  size: number;
  boxPrice: number;
  donuts: BoxDonut[];
}

interface BoxOrder {
  filling: FillingBox | null;
  boxes: BoxLine[];
}

const STORAGE_KEY = "rowszein_box_order";
const EMPTY: BoxOrder = { filling: null, boxes: [] };

function load(): BoxOrder {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as BoxOrder) : EMPTY;
    return Array.isArray(parsed?.boxes) ? parsed : EMPTY;
  } catch {
    // Unreadable or blocked storage: start with an empty order rather than fail.
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

  const startBox = useCallback((size: number, price: number) => {
    setOrder(current => ({ ...current, filling: { size, boxPrice: price, donuts: [] } }));
  }, []);

  const cancelBox = useCallback(() => setOrder(current => ({ ...current, filling: null })), []);

  /** Puts a donut in the next empty slot; ignored when no box is open or it is full. */
  const addToBox = useCallback((product: Product) => {
    setOrder(current => {
      const filling = current.filling;
      if (!filling || filling.donuts.length >= filling.size || !canGoInBox(product)) return current;
      return { ...current, filling: { ...filling, donuts: [...filling.donuts, donutFrom(product)] } };
    });
  }, []);

  const removeFromBox = useCallback((index: number) => {
    setOrder(current =>
      current.filling
        ? { ...current, filling: { ...current.filling, donuts: current.filling.donuts.filter((_, slot) => slot !== index) } }
        : current,
    );
  }, []);

  const finishBox = useCallback(() => {
    setOrder(current => {
      const filling = current.filling;
      if (!filling || filling.donuts.length !== filling.size) return current;
      const line: BoxLine = { key: newKey(), name: `Box of ${filling.size}`, size: filling.size, boxPrice: filling.boxPrice, donuts: filling.donuts };
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
    addToBox,
    removeFromBox,
    finishBox,
    addReadyMade,
    removeBox,
    clearBoxes,
    restoreBoxes,
  };
}
