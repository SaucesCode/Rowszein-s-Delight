import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRecipe, useCreateRecipe, useUpdateRecipe } from "@/hooks/useRecipes";
import { useIngredients } from "@/hooks/useIngredients";
import { useProducts } from "@/hooks/useProducts";
import { Plus, Trash2 } from "lucide-react";

const recipeSchema = z.object({
  product: z.coerce.number().min(1, "Product is required"),
  notes: z.string().optional(),
  recipe_ingredients: z
    .array(
      z.object({
        ingredient: z.coerce.number().min(1, "Ingredient is required"),
        quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
      }),
    )
    .min(1, "At least one ingredient is required"),
});

type RecipeForm = z.infer<typeof recipeSchema>;

export default function RecipeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: recipe, isLoading: recipeLoading } = useRecipe(Number(id));
  const { data: productsData } = useProducts();
  const { data: ingredientsData } = useIngredients();

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe(Number(id));

  const products = productsData?.data?.results ?? [];
  const ingredients = ingredientsData?.data?.results ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<RecipeForm>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      recipe_ingredients: [{ ingredient: 0, quantity: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "recipe_ingredients",
  });

  useEffect(() => {
    if (recipe) {
      reset({
        product: recipe.product,
        notes: recipe.notes ?? "",
        recipe_ingredients: recipe.recipe_ingredients?.map(ri => ({
          ingredient: ri.ingredient,
          quantity: Number(ri.quantity),
        })) ?? [{ ingredient: 0, quantity: 0 }],
      });
    }
  }, [recipe, reset]);

  const onSubmit = (data: RecipeForm) => {
    if (isEdit) {
      updateRecipe.mutate(data);
    } else {
      createRecipe.mutate(data);
    }
  };

  const isPending = createRecipe.isPending || updateRecipe.isPending;

  if (isEdit && recipeLoading) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">
          {isEdit ? "Edit Recipe" : "Add Recipe"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEdit ? "Update recipe ingredients" : "Define ingredients for a product"}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Product */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select
              {...register("product")}
              disabled={isEdit}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value={0}>Select a product</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.product && (
              <p className="text-xs text-red-500 mt-1">{errors.product.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              placeholder="Any notes about this recipe..."
            />
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Ingredients</h2>
            <button
              type="button"
              onClick={() => append({ ingredient: 0, quantity: 0 })}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
            >
              <Plus size={14} />
              Add Row
            </button>
          </div>

          {errors.recipe_ingredients?.root && (
            <p className="text-xs text-red-500 mb-3">
              {errors.recipe_ingredients.root.message}
            </p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-3">
                <div className="flex-1">
                  <select
                    {...register(`recipe_ingredients.${index}.ingredient`)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value={0}>Select ingredient</option>
                    {ingredients.map((ing: any) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                  {errors.recipe_ingredients?.[index]?.ingredient && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.recipe_ingredients[index]?.ingredient?.message}
                    </p>
                  )}
                </div>

                <div className="w-32">
                  <input
                    {...register(`recipe_ingredients.${index}.quantity`)}
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  {errors.recipe_ingredients?.[index]?.quantity && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.recipe_ingredients[index]?.quantity?.message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="mt-2 text-slate-400 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEdit ? "Update Recipe" : "Add Recipe"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/recipes")}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
