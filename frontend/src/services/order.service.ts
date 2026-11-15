import api from "./api";
import type { orderPayload } from "@/lib/orderCheckout";
import type { OrderFilter, OwnerOrder, OwnerOrderList, PlacedOrder, PublicOrder } from "@/types/order.types";

export type PlaceOrderPayload = ReturnType<typeof orderPayload>;

/** A refused public request: its status, the customer-facing message, and any per-field messages. */
export class OrderRequestError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<{ data: T; status: number }> {
  const response = await fetch(path, { credentials: "omit", redirect: "error", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    const fields: Record<string, string> = {};
    if (error && typeof error === "object" && !("message" in error)) {
      for (const [key, messages] of Object.entries(error)) {
        if (Array.isArray(messages) && typeof messages[0] === "string") fields[key] = messages[0];
      }
    }
    const message = (error && typeof error === "object" && typeof error.message === "string" && error.message)
      || fields.non_field_errors
      || "Something went wrong. Try again.";
    throw new OrderRequestError(response.status, message, fields);
  }
  return { data: body.data as T, status: response.status };
}

export const orderService = {
  /** Public: send the customer's order. A repeated client_key returns the order already saved. */
  place: async (payload: PlaceOrderPayload): Promise<PlacedOrder> =>
    (await publicRequest<PlacedOrder>("/api/orders/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })).data,
  /** Public: the customer's status page. */
  status: async (token: string, signal?: AbortSignal): Promise<PublicOrder> =>
    (await publicRequest<PublicOrder>(`/api/orders/status/${encodeURIComponent(token)}/`, { signal })).data,

  list: async (params: { status: OrderFilter; page: number }): Promise<OwnerOrderList> =>
    (await api.get("/orders/manage/", { params: { status: params.status === "all" ? "" : params.status, page: params.page } })).data.data,
  get: async (id: number): Promise<OwnerOrder> => (await api.get(`/orders/manage/${id}/`)).data.data,
  confirm: async (id: number): Promise<OwnerOrder> => (await api.post(`/orders/manage/${id}/confirm/`, {})).data.data,
  decline: async (id: number, message: string): Promise<OwnerOrder> =>
    (await api.post(`/orders/manage/${id}/decline/`, { message })).data.data,
};
