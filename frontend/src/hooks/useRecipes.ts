import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { recipeService } from "@/services/recipe.service";
import type { RecipePayload } from "@/types/recipe.types";
import toast from "react-hot-toast";
import type { Recipe } from "@/types/recipe.types";
import { recipeKeys, requestedRecord, validRecordId } from "@/lib/managementQueryKeys";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";

export function useRecipes(page = 1) {
  const { data: actor } = useMe();
  return useQuery({
    queryKey: recipeKeys.list(actor, page),
    queryFn: () => recipeService.getAll(page),
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
      toast.success("Recipe created.");
      navigate("/recipes");
    },
    onError: () => {
      toast.error("Failed to create recipe.");
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
      toast.success("Recipe updated.");
      navigate("/recipes");
    },
    onError: () => {
      toast.error("Failed to update recipe.");
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => recipeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      toast.success("Recipe deleted.");
    },
    onError: () => {
      toast.error("Failed to delete recipe.");
    },
  });
}
