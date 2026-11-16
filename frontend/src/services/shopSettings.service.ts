import api from "./api";
import type { ManagedShopSettings, PublicShopSettings, ShopSettingsPayload } from "@/types/shopSettings.types";

export const shopSettingsService = {
  /** Public, signed-out view used by the online shop. */
  getPublic: async (signal?: AbortSignal): Promise<PublicShopSettings> => {
    const response = await fetch("/api/shop/settings/", { credentials: "omit", redirect: "error", signal });
    if (!response.ok) throw new Error("Unable to load the shop's details.");
    return (await response.json()).data;
  },
  getManaged: async (): Promise<ManagedShopSettings> => (await api.get("/shop/settings/manage/")).data.data,
  save: async (payload: ShopSettingsPayload): Promise<ManagedShopSettings> =>
    (await api.put("/shop/settings/manage/", payload)).data.data,
};
