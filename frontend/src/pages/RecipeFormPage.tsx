import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRecipe, useCreateRecipe, useUpdateRecipe } from "@/hooks/useRecipes";
import { useIngredients } from "@/hooks/useIngredients";
import { useProducts } from "@/hooks/useProducts";
import { Plus, Trash2 } from "lucide-react";
import SkeletonTable from "@/components/SkeletonTable";
import RecipeCostPreview from "@/components/recipes/RecipeCostPreview";

/* ─────────────────────────────────────────────
   SCHEMA
   ───────────────────────────────────────────── */
const recipeSchema = z.object({
  product: z.coerce.number().min(1, "Product is required"),
  yield_quantity: z.coerce.number().min(1, "Batch must yield at least 1 unit"),
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

export type RecipeFormInput = z.input<typeof recipeSchema>;
export type RecipeForm = z.output<typeof recipeSchema>;

/* ─────────────────────────────────────────────
   FIELD — reusable labeled block
   ───────────────────────────────────────────── */
function Field({
  label,
  helper,
  error,
  required,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {required && (
          <span style={{ color: "#FF6FAE", marginLeft: 3 }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {helper && !error && <p className="field-helper">{helper}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
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
  } = useForm<RecipeFormInput, unknown, RecipeForm>({
    resolver: zodResolver(recipeSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "recipe_ingredients",
  });

  useEffect(() => {
    if (recipe) {
      reset({
        product: recipe.product,
        yield_quantity: recipe.yield_quantity,
        notes: recipe.notes ?? "",
        recipe_ingredients: recipe.recipe_ingredients?.map(
          (ri: { ingredient: number; quantity: number | string }) => ({
            ingredient: ri.ingredient,
            quantity: Number(ri.quantity),
          }),
        ) ?? [{ ingredient: 0, quantity: 0 }],
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
    return <SkeletonTable rows={4} cols={2} showHeader />;
  }

  return (
    <div className="max-w-400">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* ── Product + Notes ── */}
        <div className="card-surface p-6 space-y-5">
          <Field
            label="Product"
            helper="Select the product this recipe belongs to"
            error={errors.product?.message}
            required
          >
            <select
              {...register("product")}
              disabled={isEdit}
              className="field-input mt-1"
              aria-invalid={!!errors.product}
            >
              <option value={0}>Select a product…</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {isEdit && (
              <p className="field-helper">Product cannot be changed after creation.</p>
            )}
          </Field>

          <Field
            label="Batch Yield"
            helper="How many units does this recipe produce? e.g. flour/sugar/chocolate above makes 24 donuts → enter 24"
            error={errors.yield_quantity?.message}
            required
          >
            <input
              {...register("yield_quantity")}
              type="number"
              min="1"
              step="1"
              className="field-input mt-1"
              placeholder="1"
              aria-invalid={!!errors.yield_quantity}
            />
          </Field>

          <Field
            label="Notes"
            helper="Optional — preparation tips, batch size notes, special instructions"
          >
            <textarea
              {...register("notes")}
              rows={3}
              className="field-input mt-1"
              style={{ resize: "none" }}
              placeholder="e.g. Makes 12 pieces per batch, proof for 45 minutes…"
            />
          </Field>
        </div>

        {/* ── Ingredients ── */}
        <div className="card-surface p-6">
          {/* Section header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p
                className="font-heading font-semibold"
                style={{ fontSize: 14, color: "#6B4226" }}
              >
                Ingredients
              </p>
              <p className="field-helper" style={{ marginTop: 2 }}>
                List every ingredient and the exact quantity used per batch
              </p>
            </div>
            <button
              type="button"
              onClick={() => append({ ingredient: 0, quantity: 0 })}
              className="btn-ghost"
              style={{ fontSize: 12, padding: "5px 12px" }}
            >
              <Plus size={13} aria-hidden="true" />
              Add Row
            </button>
          </div>

          {/* List-level error */}
          {errors.recipe_ingredients?.root && (
            <p className="field-error mb-3" role="alert">
              {errors.recipe_ingredients.root.message}
            </p>
          )}

          {/* Column labels */}
          <div
            className="grid gap-3 mb-2 px-1"
            style={{ gridTemplateColumns: "1fr 140px 32px" }}
          >
            <p
              className="font-heading"
              style={{
                fontSize: 11,
                color: "#9B6644",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Ingredient
            </p>
            <p
              className="font-heading"
              style={{
                fontSize: 11,
                color: "#9B6644",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Quantity
            </p>
          </div>

          {/* Rows */}
          <div className="space-y-2.5">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid items-start gap-3"
                style={{ gridTemplateColumns: "1fr 140px 32px" }}
              >
                {/* Ingredient selector */}
                <div>
                  <select
                    {...register(`recipe_ingredients.${index}.ingredient`)}
                    className="field-input"
                    aria-label={`Ingredient ${index + 1}`}
                    aria-invalid={!!errors.recipe_ingredients?.[index]?.ingredient}
                  >
                    <option value={0}>Select ingredient…</option>
                    {ingredients.map((ing: any) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}) — ₱{Number(ing.cost_per_unit).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {errors.recipe_ingredients?.[index]?.ingredient && (
                    <p className="field-error mt-1" role="alert">
                      {errors.recipe_ingredients[index]?.ingredient?.message}
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <input
                    {...register(`recipe_ingredients.${index}.quantity`)}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="field-input"
                    aria-label={`Quantity for ingredient ${index + 1}`}
                    aria-invalid={!!errors.recipe_ingredients?.[index]?.quantity}
                  />
                  {errors.recipe_ingredients?.[index]?.quantity && (
                    <p className="field-error mt-1" role="alert">
                      {errors.recipe_ingredients[index]?.quantity?.message}
                    </p>
                  )}
                </div>

                {/* Remove row */}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="flex items-center justify-center rounded-lg transition-colors"
                  style={{
                    width: 32,
                    height: 38,
                    color: fields.length === 1 ? "#D1CEC7" : "#A8A49B",
                    cursor: fields.length === 1 ? "not-allowed" : "pointer",
                  }}
                  onMouseOver={e => {
                    if (fields.length > 1) {
                      (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                      (e.currentTarget as HTMLElement).style.color = "#EF4444";
                    }
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      fields.length === 1 ? "#D1CEC7" : "#A8A49B";
                  }}
                  aria-label={`Remove ingredient row ${index + 1}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {/* Add row — also available at bottom for long lists */}
          {fields.length >= 4 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px dashed #F5EDE0" }}>
              <button
                type="button"
                onClick={() => append({ ingredient: 0, quantity: 0 })}
                className="btn-ghost w-full justify-center"
                style={{ fontSize: 13 }}
              >
                <Plus size={14} aria-hidden="true" />
                Add another ingredient
              </button>
            </div>
          )}

          {/* Live cost preview — updates as ingredients/quantities/yield change */}
          <RecipeCostPreview control={control} ingredients={ingredients} />
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Saving…" : isEdit ? "Update Recipe" : "Add Recipe"}
          </button>
          <button type="button" onClick={() => navigate("/recipes")} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
