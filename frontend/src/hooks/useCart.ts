import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/types/product.types";

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */
export interface CartItem {
  product_id: number;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
}

const STORAGE_KEY = "rowszein_cart";

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function loadCart(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted or inaccessible storage — fail safe to an empty cart
    // rather than crashing the page.
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // sessionStorage can throw in private browsing / storage-full cases.
    // Cart still works in-memory for the rest of the session; we just
    // silently skip persistence rather than breaking the UI.
  }
}

/* ─────────────────────────────────────────────
   HOOK
   ───────────────────────────────────────────── */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  // Persist on every change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          image_url: product.image_url,
          quantity: 1,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity } : i)),
    );
  }, []);

  const incrementItem = useCallback((productId: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    );
  }, []);

  const decrementItem = useCallback((productId: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return {
    items,
    addItem,
    removeItem,
    setQuantity,
    incrementItem,
    decrementItem,
    clearCart,
    totalItems,
    totalAmount,
  };
}