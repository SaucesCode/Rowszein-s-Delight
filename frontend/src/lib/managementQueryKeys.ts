import type { User } from "@/services/auth.services";

type Actor = Pick<User, "id" | "role"> | undefined;
const scope = (actor: Actor) => actor ? { userId: actor.id, role: actor.role } : null;

// Keep the resource prefix: existing mutation/stock/sale invalidations still
// match all lists and details. Authority scopes cannot reuse another role's DTO.
export const ingredientKeys = {
  all: ["ingredients"] as const,
  list: (actor: Actor, page: number) => ["ingredients", "list", scope(actor), { page }] as const,
  detail: (actor: Actor, id: number) => ["ingredients", "detail", scope(actor), id] as const,
  lowStock: (actor: Actor) => ["ingredients", "low-stock", scope(actor)] as const,
};

export const recipeKeys = {
  all: ["recipes"] as const,
  list: (actor: Actor, page: number) => ["recipes", "list", scope(actor), { page }] as const,
  detail: (actor: Actor, id: number) => ["recipes", "detail", scope(actor), id] as const,
};

export const validRecordId = (id: number) => Number.isSafeInteger(id) && id > 0;

export function requestedRecord<T extends { id: number }>(id: number, record: T): T {
  if (record?.id !== id) throw new Error("The response did not match the requested record.");
  return record;
}
