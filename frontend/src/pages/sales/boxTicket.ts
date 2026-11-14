/**
 * Boxes in the Sales register: the box being filled (by picking flavours, filled evenly)
 * and the boxes on the ticket. Pure functions, so the rules are tested without a browser.
 */
import { fillEvenly } from "../../lib/boxRule.ts";
import type { Assortment } from "@/types/box.types";
import type { Product } from "@/types/product.types";
import type { SaleBox, SaleBoxPayload } from "@/types/sale.types";

export interface Flavour {
  product: number;
  name: string;
  boxExtra: number;
}

export interface BoxDonut extends Flavour {
  quantity: number;
}

/** The box being filled right now. */
export interface OpenBox {
  boxSizeId: number;
  size: number;
  maxFlavors: number;
  basePrice: number;
  name: string;
  flavours: Flavour[];
}

/** A box on the ticket. Saved boxes are already on the sale and can only be kept or removed. */
export interface TicketBox {
  key?: string;
  boxSizeId?: number;
  assortmentId?: number;
  name: string;
  size: number;
  price: number;
  shopPrice: number;
  contents: BoxDonut[];
  saved: boolean;
}

const centavos = (pesos: number) => Math.round(pesos * 100);

/** Pick a flavour, or unpick it if it's already in the box. */
export function toggleFlavour(
  box: OpenBox,
  product: Pick<Product, "id" | "name" | "box_extra" | "partner">,
): OpenBox | { error: string } {
  if (box.flavours.some(flavour => flavour.product === product.id)) {
    return { ...box, flavours: box.flavours.filter(flavour => flavour.product !== product.id) };
  }
  if (product.partner) return { error: "Not in boxes" };
  if (box.flavours.length >= box.maxFlavors) return { error: `This box takes up to ${box.maxFlavors} flavours` };
  return { ...box, flavours: [...box.flavours, { product: product.id, name: product.name, boxExtra: Number(product.box_extra ?? 0) }] };
}

export function openBoxContents(box: OpenBox): BoxDonut[] {
  return fillEvenly(box.size, box.flavours).map(({ item, quantity }) => ({ ...item, quantity }));
}

const priceOf = (basePrice: number, contents: BoxDonut[]) =>
  (centavos(basePrice) + contents.reduce((sum, donut) => sum + centavos(donut.boxExtra) * donut.quantity, 0)) / 100;

export function openBoxPrice(box: OpenBox): number {
  return priceOf(box.basePrice, openBoxContents(box));
}

/** The filled box as a ticket line. Only call with at least one flavour picked. */
export function closeOpenBox(box: OpenBox): TicketBox {
  const contents = openBoxContents(box);
  const price = priceOf(box.basePrice, contents);
  return { boxSizeId: box.boxSizeId, name: box.name, size: box.size, price, shopPrice: price, contents, saved: false };
}

export function readyMadeBox(assortment: Assortment): TicketBox {
  const contents = assortment.items.map(item => ({
    product: item.product_id, name: item.name, boxExtra: Number(item.box_extra), quantity: item.quantity,
  }));
  const price = Number(assortment.price);
  return { assortmentId: assortment.id, name: assortment.name, size: assortment.box_size.size, price, shopPrice: price, contents, saved: false };
}

export function savedBox(box: SaleBox): TicketBox {
  const price = Number(box.price);
  return {
    key: box.key, boxSizeId: box.box_size_id, assortmentId: box.assortment_id ?? undefined, name: box.name, size: box.size,
    price, shopPrice: price, saved: true,
    contents: box.contents.map(content => ({
      product: content.product, name: content.product_name, quantity: content.quantity, boxExtra: Number(content.box_extra),
    })),
  };
}

/** What the server needs: a saved box by key; a new box with its price only when the owner changed it. */
export function boxPayload(box: TicketBox): SaleBoxPayload {
  if (box.saved && box.key) return { key: box.key };
  const discount = centavos(box.price) !== centavos(box.shopPrice) ? { price: box.price } : {};
  if (box.assortmentId !== undefined) return { assortment: box.assortmentId, ...discount };
  return {
    box_size: box.boxSizeId as number,
    contents: box.contents.map(donut => ({ product: donut.product, quantity: donut.quantity })),
    ...discount,
  };
}
