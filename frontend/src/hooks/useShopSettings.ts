import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/useAuth";
import { queryScope } from "@/lib/managementQueryKeys";
import { can } from "@/lib/permissions";
import { shopSettingsService } from "@/services/shopSettings.service";
import type { ManagedShopSettings, ShopSettingsPayload } from "@/types/shopSettings.types";

const PUBLIC_KEY = ["shop-settings", "public"];

/** The shop's details for customers. Never awaited before the pastry case renders. */
export function useShopSettings() {
  return useQuery({
    queryKey: PUBLIC_KEY,
    queryFn: ({ signal }) => shopSettingsService.getPublic(signal),
    retry: false,
    staleTime: 60_000,
  });
}

export function useManagedShopSettings() {
  const auth = useMe();
  return useQuery({
    queryKey: ["shop-settings", "manage", queryScope(auth.data)],
    queryFn: shopSettingsService.getManaged,
    enabled: can(auth.data, "shop.manage"),
  });
}

export function useSaveShopSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShopSettingsPayload) => shopSettingsService.save(payload),
    onSuccess: (saved: ManagedShopSettings) => {
      queryClient.setQueriesData({ queryKey: ["shop-settings", "manage"] }, saved);
      void queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
    },
  });
}
