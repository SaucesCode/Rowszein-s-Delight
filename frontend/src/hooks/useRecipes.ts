import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { recipeService } from "@/services/recipe.service";
import type { RecipePayload } from "@/types/recipe.types";
import toast from "react-hot-toast";
import type { Recipe } from "@/types/recipe.types";
import { recipeKeys, requestedRecord, validRecordId } from "@/lib/managementQueryKeys";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import type { ListingParams } from "@/lib/listingParams";

export function useRecipes(page = 1, params: ListingParams = {}) {
  const { data: actor } = useMe();
  return useQuery({
    queryKey: recipeKeys.list(actor, page, params),
    queryFn: ({ signal }) => recipeService.getAll(page, params, signal),
    enabled: can(actor, "recipes.manage"),
    retry: false,
  });
}

const ALL_PAGES_LIMIT = 10;

/** Every recipe, across pages, so each donut on the costing sheet can link to its own. */
export function useAllRecipes() {
  const { data: actor } = useMe();
  return useQuery({
    queryKey: [...recipeKeys.all, "every", actor?.id ?? null],
    queryFn: async ({ signal }) => {
      const recipes: Recipe[] = [];
      for (let page = 1; page <= ALL_PAGES_LIMIT; page += 1) {
        const listing = await recipeService.getAll(page, { ordering: "name", page_size: 20 }, signal);
        recipes.push(...listing.data.results);
        if (!listing.data.next) break;
      }
      return recipes;
    },
    enabled: can(actor, "recipes.manage"),
  });
}

export function useRecipe(id: number) {
  const { data: actor } = useMe();
  const enabled = validRecordId(id) && can(actor, "recipes.manage");
  const query = useQuery<Recipe>({
    queryKey: recipeKeys.detail(actor, id),
    queryFn: async () => requestedRecord<Recipe>(id, await recipeService.getOne(id)),
    enabled,
    retry: false,
  });
  return { ...query, data: enabled && !query.isError && query.data?.id === id ? query.data : undefined };
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RecipePayload) => recipeService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Recipe saved. Its cost is worked out.");
      navigate("/recipes");
    },
    onError: () => {
      toast.error("Couldn't save the recipe. Check the connection and try again.");
    },
  });
}

export function useUpdateRecipe(id: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RecipePayload) => recipeService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Changes saved.");
      navigate("/recipes");
    },
    onError: () => {
      toast.error("Couldn't save the changes. Check the connection and try again.");
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => recipeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Recipe deleted.");
    },
    onError: () => {
      toast.error("Couldn't delete the recipe. Check the connection and try again.");
    },
  });
}
