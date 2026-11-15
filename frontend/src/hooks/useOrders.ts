import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/useAuth";
import { queryScope } from "@/lib/managementQueryKeys";
import { can } from "@/lib/permissions";
import { orderService, type PlaceOrderPayload } from "@/services/order.service";
import type { OrderFilter } from "@/types/order.types";

const REFRESH = 60_000;

export function usePlaceOrder() {
  return useMutation({ mutationFn: (payload: PlaceOrderPayload) => orderService.place(payload) });
}

/** The customer's status page; rechecks when they come back to the tab. */
export function useOrderStatus(token: string) {
  return useQuery({
    queryKey: ["order-status", token],
    queryFn: ({ signal }) => orderService.status(token, signal),
    retry: false,
    refetchOnWindowFocus: true,
  });
}

function useCanManage() {
  const auth = useMe();
  return { scope: queryScope(auth.data), allowed: can(auth.data, "orders.manage") };
}

export function useOrders(status: OrderFilter, page: number) {
  const { scope, allowed } = useCanManage();
  return useQuery({
    queryKey: ["orders", scope, status, page],
    queryFn: () => orderService.list({ status, page }),
    enabled: allowed,
    refetchInterval: REFRESH,
    placeholderData: keepPreviousData,
  });
}

/** How many orders are waiting, for the sidebar badge and the Home card. */
export function useWaitingCount() {
  const { scope, allowed } = useCanManage();
  return useQuery({
    queryKey: ["orders", scope, "waiting-count"],
    queryFn: () => orderService.list({ status: "waiting", page: 1 }),
    select: data => data.waiting_count,
    enabled: allowed,
    refetchInterval: REFRESH,
  });
}

export function useOrder(id: number) {
  const { scope, allowed } = useCanManage();
  return useQuery({ queryKey: ["orders", scope, "detail", id], queryFn: () => orderService.get(id), enabled: allowed && id > 0 });
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => orderService.confirm(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useDeclineOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) => orderService.decline(id, message),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
}
