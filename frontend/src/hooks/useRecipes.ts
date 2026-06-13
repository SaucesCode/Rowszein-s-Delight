import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { recipeService } from "@/services/recipe.service";
import type { RecipePayload } from "@/types/recipe.types";
import toast from "react-hot-toast";

export function useRecipes(page = 1) {
  return useQuery({
    queryKey: ["recipes", page],
    queryFn: () => recipeService.getAll(page),
  });
}

export function useRecipe(id: number) {
  return useQuery({
    queryKey: ["recipes", id],
    queryFn: () => recipeService.getOne(id),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RecipePayload) => recipeService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
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
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
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
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe deleted.");
    },
    onError: () => {
      toast.error("Failed to delete recipe.");
    },
  });
}
