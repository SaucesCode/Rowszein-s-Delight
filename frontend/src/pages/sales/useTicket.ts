import { useCallback, useMemo, useState } from "react";
import type { Product } from "@/types/product.types";

export interface TicketLine {
  product: number;
  name: string;
  category?: string;
  unitPrice: number;
  quantity: number;
}

const centavos = (pesos: number) => Math.round(pesos * 100);

/** The order being rung up. Totals are summed in centavos so ₱45.00 × 3 never drifts. */
export function useTicket(initial: TicketLine[] = []) {
  const [lines, setLines] = useState<TicketLine[]>(initial);

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

  const clear = useCallback(() => setLines([]), []);

  const totals = useMemo(() => {
    const cents = lines.reduce((sum, line) => sum + centavos(line.unitPrice) * line.quantity, 0);
    return { amount: cents / 100, pieces: lines.reduce((sum, line) => sum + line.quantity, 0) };
  }, [lines]);

  const quantityOf = useCallback(
    (productId: number) => lines.find(line => line.product === productId)?.quantity ?? 0,
    [lines],
  );

  return { lines, add, change, setPrice, clear, totals, quantityOf };
}

export type Ticket = ReturnType<typeof useTicket>;
export const lineTotal = (line: TicketLine) => (centavos(line.unitPrice) * line.quantity) / 100;
