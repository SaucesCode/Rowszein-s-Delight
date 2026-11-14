import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useMe } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/lib/csrfTransport";
import { queryScope } from "@/lib/managementQueryKeys";
import { can } from "@/lib/permissions";
import { partnerService } from "@/services/partner.service";
import type { Partner, PartnerPayload, PartnerPaymentPayload } from "@/types/partner.types";

/** Everything partner money touches, so one refresh after a change keeps every screen honest. */
const MONEY_KEYS = [["partners"], ["partner-payouts"], ["partner-payments"], ["dashboard"]];

export function usePartners() {
  const auth = useMe();
  return useQuery({
    queryKey: ["partners", queryScope(auth.data)],
    queryFn: partnerService.list,
    enabled: can(auth.data, "catalog.read"),
  });
}

export function useSavePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Partial<PartnerPayload> }) =>
      id ? partnerService.update(id, payload) : partnerService.create(payload as PartnerPayload),
    onSuccess: (partner: Partner) => {
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`${partner.name} saved.`);
    },
  });
}

export function usePartnerPayouts(range: { date_from: string; date_to: string }) {
  const auth = useMe();
  return useQuery({
    queryKey: ["partner-payouts", range.date_from, range.date_to, queryScope(auth.data)],
    queryFn: () => partnerService.payouts(range),
    enabled: can(auth.data, "finance.read"),
  });
}

export function usePartnerPayments(partnerId: number | null, page = 1) {
  const auth = useMe();
  return useQuery({
    queryKey: ["partner-payments", partnerId, page, queryScope(auth.data)],
    queryFn: () => partnerService.payments(partnerId as number, page),
    enabled: partnerId !== null && can(auth.data, "finance.read"),
  });
}

function useMoneyMutation<T>(mutationFn: (args: T) => Promise<unknown>, success: string, failure: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const queryKey of MONEY_KEYS) void queryClient.invalidateQueries({ queryKey });
      toast.success(success);
    },
    onError: error => {
      toast.error(apiErrorMessage(error, failure));
    },
  });
}

export function useRecordPayment() {
  return useMoneyMutation(
    ({ partnerId, payload }: { partnerId: number; payload: PartnerPaymentPayload }) => partnerService.pay(partnerId, payload),
    "Payment recorded.",
    "Couldn't record the payment. Check the connection and try again.",
  );
}

export function useVoidPayment() {
  return useMoneyMutation(
    ({ partnerId, paymentId, reason }: { partnerId: number; paymentId: number; reason: string }) =>
      partnerService.void(partnerId, paymentId, reason),
    "Payment voided.",
    "Couldn't void the payment. Check the connection and try again.",
  );
}
