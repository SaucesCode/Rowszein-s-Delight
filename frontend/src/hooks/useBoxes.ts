import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useMe } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/lib/csrfTransport";
import { queryScope, requestedRecord, validRecordId } from "@/lib/managementQueryKeys";
import { can } from "@/lib/permissions";
import { boxService } from "@/services/box.service";
import { productService } from "@/services/product.service";
import type { AssortmentPayload, BoxSize, BoxSizePayload } from "@/types/box.types";
import type { Product } from "@/types/product.types";

const COLLECTION_PAGE_LIMIT = 10;

export function useBoxSizes() {
  const auth = useMe();
  return useQuery({
    queryKey: ["boxes", "sizes", queryScope(auth.data)],
    queryFn: boxService.sizes,
    enabled: can(auth.data, "catalog.read"),
  });
}

export function useSaveBoxSize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: BoxSizePayload }) =>
      id ? boxService.updateSize(id, payload) : boxService.createSize(payload),
    onSuccess: (box: BoxSize) => {
      void queryClient.invalidateQueries({ queryKey: ["boxes"] });
      toast.success(`Box of ${box.size} saved.`);
    },
    onError: error => {
      toast.error(apiErrorMessage(error, "Couldn't save the box. Check the connection and try again."));
    },
  });
}

export function useDeleteBoxSize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (box: BoxSize) => boxService.deleteSize(box.id),
    onSuccess: (_data, box) => {
      void queryClient.invalidateQueries({ queryKey: ["boxes"] });
      toast.success(`Box of ${box.size} removed.`);
    },
    onError: error => {
      toast.error(apiErrorMessage(error, "Couldn't remove the box. Check the connection and try again."));
    },
  });
}

export function useAssortments() {
  const auth = useMe();
  return useQuery({
    queryKey: ["boxes", "assortments", queryScope(auth.data)],
    queryFn: boxService.assortments,
    enabled: can(auth.data, "catalog.read"),
  });
}

export function useAssortment(id: number) {
  const auth = useMe();
  return useQuery({
    queryKey: ["boxes", "assortment", queryScope(auth.data), id],
    queryFn: async () => requestedRecord(id, await boxService.assortment(id)),
    enabled: validRecordId(id) && can(auth.data, "catalog.read"),
  });
}

export function useSaveAssortment(id?: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: AssortmentPayload) =>
      id ? boxService.updateAssortment(id, payload) : boxService.createAssortment(payload),
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: ["boxes"] });
      toast.success(`${saved.name} saved.`);
      navigate("/products/boxes");
    },
    onError: error => {
      toast.error(apiErrorMessage(error, "Couldn't save the box. Check the connection and try again."));
    },
  });
}

export function useDeleteAssortment() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: number) => boxService.deleteAssortment(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["boxes", "assortment"], predicate: query => query.queryKey.at(-1) === id });
      void queryClient.invalidateQueries({ queryKey: ["boxes"] });
      toast.success("Ready-made box deleted.");
      navigate("/products/boxes");
    },
    onError: error => {
      toast.error(apiErrorMessage(error, "Couldn't delete the box. Check the connection and try again."));
    },
  });
}

/** Every donut in the collection, on sale or resting, for filling ready-made boxes. */
export function useCollection() {
  const auth = useMe();
  return useQuery({
    queryKey: ["products", "collection", queryScope(auth.data)],
    queryFn: async ({ signal }) => {
      const products: Product[] = [];
      for (let page = 1; page <= COLLECTION_PAGE_LIMIT; page += 1) {
        const listing = await productService.getAll(page, { ordering: "name", page_size: 20 }, signal);
        products.push(...listing.data.results);
        if (!listing.data.next) break;
      }
      return products;
    },
    enabled: can(auth.data, "catalog.manage"),
  });
}

/** Boxes the online shop can sell right now (signed-out view). */
export function useShopBoxes() {
  return useQuery({
    queryKey: ["boxes", "shop"],
    queryFn: ({ signal }) => boxService.shop(signal),
    retry: false,
  });
}
