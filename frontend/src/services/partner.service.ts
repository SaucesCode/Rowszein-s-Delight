import api from "./api";
import type {
  Partner,
  PartnerPayload,
  PartnerPayment,
  PartnerPaymentPayload,
  PartnerPayouts,
  PartnerSummary,
} from "@/types/partner.types";

interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const partnerService = {
  /** Owners get full partner records; staff get the summary. */
  list: async (): Promise<(Partner | PartnerSummary)[]> => (await api.get("/products/partners/")).data.data,
  create: async (payload: PartnerPayload): Promise<Partner> => (await api.post("/products/partners/", payload)).data.data,
  update: async (id: number, payload: Partial<PartnerPayload>): Promise<Partner> =>
    (await api.patch(`/products/partners/${id}/`, payload)).data.data,
  remove: async (id: number) => (await api.delete(`/products/partners/${id}/`)).data,

  payouts: async (range: { date_from: string; date_to: string }): Promise<PartnerPayouts> =>
    (await api.get("/products/partners/payouts/", { params: range })).data.data,
  payments: async (id: number, page = 1): Promise<Page<PartnerPayment>> =>
    (await api.get(`/products/partners/${id}/payments/`, { params: { page } })).data.data,
  pay: async (id: number, payload: PartnerPaymentPayload): Promise<PartnerPayment> =>
    (await api.post(`/products/partners/${id}/payments/`, payload)).data.data,
  void: async (id: number, paymentId: number, reason: string): Promise<PartnerPayment> =>
    (await api.post(`/products/partners/${id}/payments/${paymentId}/void/`, { reason })).data.data,
};
