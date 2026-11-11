import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import { queryScope, validRecordId } from "@/lib/managementQueryKeys";
import { listingParams, type ListingParams } from "@/lib/listingParams";
import { listingService, type ListKind, type LookupRecord } from "@/services/listing.service";

export const listingRoot = (kind: ListKind) => kind === "categories" ? "product-categories" : kind;
export function useListingPages<T>(kind: ListKind, params: ListingParams, purpose = "lookup", enabled = true, publicOnly = false) {
  const auth = useMe();
  const allowed = !auth.isPending && (kind === "ingredients" ? can(auth.data, "stock.read") : kind === "recipes" ? can(auth.data, "recipes.manage") : true);
  return useInfiniteQuery({
    queryKey: [listingRoot(kind), purpose, publicOnly ? "public" : queryScope(auth.data), listingParams(params)],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => listingService.get<T>(kind, { ...params, page: pageParam }, signal, publicOnly),
    getNextPageParam: (last, _pages, previousPage) => last.data.next ? previousPage + 1 : undefined,
    enabled: (publicOnly || allowed) && enabled,
    retry: false,
  });
}
export function useSelectedLookup(kind: ListKind, id: number, publicOnly = false) {
  const auth = useMe();
  return useQuery({
    queryKey: [listingRoot(kind), "selected", publicOnly ? "public" : queryScope(auth.data), id],
    queryFn: async ({ signal }) => {
      const result = await listingService.get<LookupRecord>(kind, { id }, signal, publicOnly);
      return result.data.results.find(record => record.id === id) ?? null;
    },
    enabled: validRecordId(id) && (publicOnly || (!auth.isPending && (kind === "ingredients" ? can(auth.data, "stock.read") : true))),
    retry: false,
  });
}
