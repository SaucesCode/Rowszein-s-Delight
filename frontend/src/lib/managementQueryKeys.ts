import type { User } from "@/services/auth.services";
import type { ListingParams } from "./listingParams";
import { listingParams } from "./listingParams.ts";

type Actor = Pick<User, "id" | "role"> | undefined;
export const queryScope = (actor: Actor) => actor ? { userId: actor.id, role: actor.role } : null;
const scope = queryScope;

// Keep the resource prefix: existing mutation/stock/sale invalidations still
// match all lists and details. Authority scopes cannot reuse another role's DTO.
export const ingredientKeys = {
  all: ["ingredients"] as const,
  list: (actor: Actor, page: number, params: ListingParams = {}) => ["ingredients", "list", scope(actor), listingParams({ ...params, page })] as const,
  detail: (actor: Actor, id: number) => ["ingredients", "detail", scope(actor), id] as const,
  lowStock: (actor: Actor) => ["ingredients", "low-stock", scope(actor)] as const,
};

export const recipeKeys = {
  all: ["recipes"] as const,
  list: (actor: Actor, page: number, params: ListingParams = {}) => ["recipes", "list", scope(actor), listingParams({ ...params, page })] as const,
  detail: (actor: Actor, id: number) => ["recipes", "detail", scope(actor), id] as const,
};

export const validRecordId = (id: number) => Number.isSafeInteger(id) && id > 0;

export function requestedRecord<T extends { id: number }>(id: number, record: T): T {
  if (record?.id !== id) throw new Error("The response did not match the requested record.");
  return record;
}
