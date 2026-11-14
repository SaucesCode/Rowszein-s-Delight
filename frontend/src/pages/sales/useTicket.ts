import { useCallback, useMemo, useState } from "react";
import type { Assortment, BoxSize } from "@/types/box.types";
import type { Product } from "@/types/product.types";
import { closeOpenBox, readyMadeBox, toggleFlavour, type OpenBox, type TicketBox } from "./boxTicket.ts";

export interface TicketLine {
  product: number;
  name: string;
  category?: string;
  unitPrice: number;
  quantity: number;
}

const centavos = (pesos: number) => Math.round(pesos * 100);

/** "3 donuts", "1 box, 3 donuts", or "items" once a partner's item (a muffin, a cake) is in the order. */
export function countLabel(pieces: number, hasPartnerItem: boolean, boxes = 0): string {
  const unit = hasPartnerItem ? "item" : "donut";
  const singles = `${pieces} ${unit}${pieces === 1 ? "" : "s"}`;
  if (!boxes) return singles;
  const boxText = `${boxes} box${boxes === 1 ? "" : "es"}`;
  return pieces ? `${boxText}, ${singles}` : boxText;
}

/** The order being rung up. Totals are summed in centavos so ₱45.00 × 3 never drifts. */
export function useTicket(initial: TicketLine[] = [], initialBoxes: TicketBox[] = []) {
  const [lines, setLines] = useState<TicketLine[]>(initial);
  const [boxes, setBoxes] = useState<TicketBox[]>(initialBoxes);
  const [openBox, setOpenBox] = useState<OpenBox | null>(null);

  const startBox = useCallback((size: BoxSize) => {
    setOpenBox({ boxSizeId: size.id, size: size.size, maxFlavors: size.max_flavors, basePrice: Number(size.price), name: `Box of ${size.size}`, flavours: [] });
  }, []);

  /** Pick or unpick a flavour in the open box; returns why it couldn't, if it couldn't. */
  const toggleInBox = useCallback(
    (product: Product): string | null => {
      if (!openBox) return null;
      const next = toggleFlavour(openBox, product);
      if ("error" in next) return next.error;
      setOpenBox(next);
      return null;
    },
    [openBox],
  );

  const finishBox = useCallback(() => {
    if (!openBox || openBox.flavours.length === 0) return;
    setBoxes(current => [...current, closeOpenBox(openBox)]);
    setOpenBox(null);
  }, [openBox]);

  const removeFlavour = useCallback(
    (productId: number) =>
      setOpenBox(current => (current ? { ...current, flavours: current.flavours.filter(flavour => flavour.product !== productId) } : current)),
    [],
  );

  const cancelBox = useCallback(() => setOpenBox(null), []);
  const addReadyMade = useCallback((assortment: Assortment) => setBoxes(current => [...current, readyMadeBox(assortment)]), []);
  const removeBox = useCallback((index: number) => setBoxes(current => current.filter((_, position) => position !== index)), []);
  const setBoxPrice = useCallback(
    (index: number, price: number) =>
      setBoxes(current => current.map((box, position) => (position === index ? { ...box, price } : box))),
    [],
  );

  const add = useCallback((product: Product) => {
    setLines(current => {
      const existing = current.find(line => line.product === product.id);
      if (existing) {
        return current.map(line => (line.product === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...current,
        {
          product: product.id,
          name: product.name,
          category: product.category?.name,
          unitPrice: Number(product.price),
          quantity: 1,
        },
      ];
    });
  }, []);

  const change = useCallback((productId: number, delta: number) => {
    setLines(current =>
      current
        .map(line => (line.product === productId ? { ...line, quantity: line.quantity + delta } : line))
        .filter(line => line.quantity > 0),
    );
  }, []);

  const setPrice = useCallback((productId: number, unitPrice: number) => {
    setLines(current => current.map(line => (line.product === productId ? { ...line, unitPrice } : line)));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setBoxes([]);
    setOpenBox(null);
  }, []);

  const totals = useMemo(() => {
    const cents =
      lines.reduce((sum, line) => sum + centavos(line.unitPrice) * line.quantity, 0) +
      boxes.reduce((sum, box) => sum + centavos(box.price), 0);
    return { amount: cents / 100, pieces: lines.reduce((sum, line) => sum + line.quantity, 0), boxes: boxes.length };
  }, [lines, boxes]);

  const quantityOf = useCallback(
    (productId: number) => lines.find(line => line.product === productId)?.quantity ?? 0,
    [lines],
  );

  return {
    lines, add, change, setPrice, clear, totals, quantityOf,
    boxes, openBox, startBox, toggleInBox, removeFlavour, finishBox, cancelBox, addReadyMade, removeBox, setBoxPrice,
  };
}

export type Ticket = ReturnType<typeof useTicket>;
export const lineTotal = (line: TicketLine) => (centavos(line.unitPrice) * line.quantity) / 100;
