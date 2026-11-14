import { useId, useState } from "react";
import { useBlocker, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, X } from "lucide-react";
import { useCreateRecipe, useDeleteRecipe, useRecipe, useUpdateRecipe } from "@/hooks/useRecipes";
import { useAllIngredients } from "@/hooks/useIngredients";
import { useProductMargins } from "@/hooks/useDashboard";
import { validRecordId } from "@/lib/managementQueryKeys";
import { unitLabel } from "@/lib/stockStatus";
import { flavorOf, flavorTint } from "@/lib/flavor";
import type { Recipe } from "@/types/recipe.types";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import DonutArt from "@/components/DonutArt";
import Row from "@/components/ui/SettingsRow";
import { formatPeso } from "@/pages/dashboard/report-format";
import "./recipes/recipes.css";

const recipeSchema = z.object({
  product: z.coerce.number().min(1, "Choose which donut this recipe makes"),
  yield_quantity: z.coerce.number().int("Use a whole number of donuts").min(1, "A batch has to make at least 1 donut"),
  notes: z.string().optional(),
  recipe_ingredients: z
    .array(
      z.object({
        ingredient: z.coerce.number().min(1, "Choose an ingredient"),
        quantity: z.coerce.number().min(0.01, "Enter how much goes in, more than 0"),
      }),
    )
    .min(1, "Add at least one ingredient"),
});

type FormInput = z.input<typeof recipeSchema>;
type FormOutput = z.output<typeof recipeSchema>;

const centavos = (pesos: number) => Math.round(pesos * 100);

function RecipeForm({ recipe, presetProduct }: { recipe?: Recipe; presetProduct?: number }) {
  const navigate = useNavigate();
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const isEdit = !!recipe;

  const margins = useProductMargins();
  const ingredients = useAllIngredients();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe(recipe?.id ?? 0);
  const deleteRecipe = useDeleteRecipe();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(recipeSchema),
    defaultValues: recipe
      ? {
          product: recipe.product,
          yield_quantity: recipe.yield_quantity,
          notes: recipe.notes ?? "",
          recipe_ingredients: recipe.recipe_ingredients.map(row => ({ ingredient: row.ingredient, quantity: Number(row.quantity) })),
        }
      : {
          product: presetProduct ?? 0,
          yield_quantity: 12,
          notes: "",
          recipe_ingredients: [{ ingredient: 0, quantity: "" }],
        },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "recipe_ingredients" });
  const [product, yieldQuantity, rows] = useWatch({ control, name: ["product", "yield_quantity", "recipe_ingredients"] });

  const pantry = ingredients.data ?? [];
  const pantryById = new Map(pantry.map(item => [item.id, item]));
  const donuts = (margins.data ?? []).filter(
    row => !row.is_partner && (isEdit || !row.has_recipe || row.product_id === Number(product)),
  );
  const donut = (margins.data ?? []).find(row => row.product_id === Number(product));

  const lineCost = (row?: { ingredient?: unknown; quantity?: unknown }) => {
    const item = pantryById.get(Number(row?.ingredient));
    const quantity = Number(row?.quantity);
    return item && quantity > 0 ? centavos(Number(item.cost_per_unit) * quantity) : 0;
  };
  const batchCents = (rows ?? []).reduce((sum: number, row) => sum + lineCost(row), 0);
  const perDonut = Number(yieldQuantity) > 0 ? batchCents / 100 / Number(yieldQuantity) : null;
  const price = donut ? Number(donut.selling_price) : null;
  const keep = perDonut !== null && price !== null ? price - perDonut : null;
  const keepPercent = keep !== null && price ? Math.round((keep / price) * 100) : null;

  const isSaving = createRecipe.isPending || updateRecipe.isPending;
  const isDone = createRecipe.isSuccess || updateRecipe.isSuccess || deleteRecipe.isPending || deleteRecipe.isSuccess;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && !isSaving && !isDone && currentLocation.pathname !== nextLocation.pathname,
  );

  const onSubmit = (data: FormOutput) => {
    if (recipe) updateRecipe.mutate(data);
    else createRecipe.mutate(data);
  };

  return (
    <>
      <form className="settings-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <header className="page-head">
          <div>
            <h1 className="type-page">{recipe ? `${recipe.product_name} recipe` : "Add a recipe"}</h1>
            <p className="page-lede">
              List what goes into one batch. The cost of each donut works itself out from your pantry prices.
            </p>
          </div>
        </header>

        <div className="recipe-preview" aria-live="polite">
          <span
            className="cost-art recipe-preview-art"
            style={{ background: flavorTint(flavorOf(donut?.product_name)) }}
            aria-hidden="true"
          >
            <DonutArt flavor={flavorOf(donut?.product_name)} size={64} />
          </span>
          <div className="recipe-preview-text">
            <p className="recipe-preview-name">{donut?.product_name ?? "Choose a donut"}</p>
            <p className="recipe-preview-figures">
              {perDonut === null || batchCents === 0 ? (
                "Add ingredients to see what each donut costs."
              ) : (
                <>
                  Costs <strong className="num">{formatPeso(perDonut)}</strong> per donut
                  {price !== null && keep !== null && (
                    <>
                      {". "}Sells for <strong className="num">{formatPeso(price)}</strong>
                      {keep >= 0 ? (
                        <>, you keep <strong className="num is-good">{formatPeso(keep)}</strong> ({keepPercent}%).</>
                      ) : (
                        <>, so each one <strong className="num is-warn">loses {formatPeso(Math.abs(keep))}</strong>.</>
                      )}
                    </>
                  )}
                </>
              )}
            </p>
            {batchCents > 0 && (
              <p className="recipe-preview-batch num">Whole batch: {formatPeso(batchCents / 100)}</p>
            )}
          </div>
        </div>

        <section className="settings-group" aria-labelledby={field("donut")}>
          <h2 id={field("donut")} className="settings-group-title">The donut</h2>
          <div className="settings-card">
            <Row label="Donut" htmlFor={field("product")} error={errors.product?.message} hint={isEdit ? "A recipe always stays with its donut." : undefined}>
              {isEdit ? (
                <p className="settings-readout">{recipe?.product_name}</p>
              ) : (
                <select
                  id={field("product")}
                  className="field-input"
                  disabled={margins.isPending}
                  aria-invalid={!!errors.product}
                  {...register("product")}
                  value={String(product ?? 0)}
                >
                  <option value={0}>{margins.isPending ? "Loading donuts…" : "Choose a donut"}</option>
                  {donuts.map(row => (
                    <option key={row.product_id} value={row.product_id}>{row.product_name}</option>
                  ))}
                </select>
              )}
            </Row>
            <Row
              label="Donuts per batch"
              htmlFor={field("yield")}
              error={errors.yield_quantity?.message}
              hint="How many donuts one batch of the ingredients below makes."
            >
              <div className="settings-unit-input">
                <input
                  id={field("yield")}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  className="field-input num"
                  aria-invalid={!!errors.yield_quantity}
                  {...register("yield_quantity")}
                />
                <span aria-hidden="true">donuts</span>
              </div>
            </Row>
          </div>
        </section>

        <section className="settings-group" aria-labelledby={field("ingredients")}>
          <h2 id={field("ingredients")} className="settings-group-title">What goes into one batch</h2>
          <div className="settings-card recipe-lines">
            {ingredients.isError && (
              <p className="field-error recipe-lines-note" role="alert">
                Couldn't load the pantry.{" "}
                <button type="button" className="link-button" onClick={() => void ingredients.refetch()}>Try again</button>
              </p>
            )}
            {!ingredients.isPending && pantry.length === 0 && !ingredients.isError && (
              <p className="field-hint recipe-lines-note">Your pantry is empty. Add ingredients in the Pantry first.</p>
            )}
            <ol>
              {fields.map((line, index) => {
                const row = rows?.[index];
                const item = pantryById.get(Number(row?.ingredient));
                const cost = lineCost(row);
                const rowErrors = errors.recipe_ingredients?.[index];
                return (
                  <li key={line.id} className="recipe-line">
                    <div className="recipe-line-ingredient">
                      <label htmlFor={field(`ing-${index}`)} className="sr-only">Ingredient {index + 1}</label>
                      <select
                        id={field(`ing-${index}`)}
                        className="field-input"
                        disabled={ingredients.isPending}
                        aria-invalid={!!rowErrors?.ingredient}
                        {...register(`recipe_ingredients.${index}.ingredient`)}
                        value={String(row?.ingredient ?? 0)}
                      >
                        <option value={0}>{ingredients.isPending ? "Loading the pantry…" : "Choose an ingredient"}</option>
                        {pantry.map(option => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                      {rowErrors?.ingredient && <p className="field-error">{rowErrors.ingredient.message}</p>}
                    </div>
                    <div className="recipe-line-amount">
                      <label htmlFor={field(`qty-${index}`)} className="sr-only">How much of ingredient {index + 1}</label>
                      <div className="settings-unit-input">
                        <input
                          id={field(`qty-${index}`)}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          className="field-input num"
                          aria-invalid={!!rowErrors?.quantity}
                          {...register(`recipe_ingredients.${index}.quantity`)}
                        />
                        <span aria-hidden="true">{item ? unitLabel(item.unit) : ""}</span>
                      </div>
                      {rowErrors?.quantity && <p className="field-error">{rowErrors.quantity.message}</p>}
                    </div>
                    <span className="recipe-line-cost num">{cost ? formatPeso(cost / 100) : "₱—"}</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label={`Remove ingredient ${index + 1}`}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
            {errors.recipe_ingredients?.root && (
              <p className="field-error recipe-lines-note" role="alert">{errors.recipe_ingredients.root.message}</p>
            )}
            <button type="button" className="settings-action" onClick={() => append({ ingredient: 0, quantity: "" })}>
              <Plus size={18} aria-hidden="true" />
              Add an ingredient
            </button>
          </div>
        </section>

        <section className="settings-group" aria-labelledby={field("notes")}>
          <h2 id={field("notes")} className="settings-group-title">Notes</h2>
          <div className="settings-card">
            <label htmlFor={field("notes-input")} className="sr-only">Notes</label>
            <textarea
              id={field("notes-input")}
              className="field-input settings-notes"
              rows={3}
              placeholder="Proofing time, frying temperature, anything the kitchen should know."
              {...register("notes")}
            />
          </div>
        </section>

        {recipe && (
          <section className="settings-group" aria-label="Delete">
            <div className="settings-card">
              <button type="button" className="settings-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={18} aria-hidden="true" />
                Delete recipe
              </button>
            </div>
          </section>
        )}

        <footer className="settings-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate("/recipes")}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSaving} aria-busy={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Save recipe"}
          </button>
        </footer>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete the ${recipe?.product_name ?? ""} recipe?`}
        description="The donut stays in your collection, but you won't see what it costs to make until you add a recipe again."
        confirmLabel="Delete recipe"
        cancelLabel="Keep it"
        destructive
        loading={deleteRecipe.isPending}
        onConfirm={() => recipe && deleteRecipe.mutate(recipe.id, { onSuccess: () => navigate("/recipes") })}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description="Your changes to this recipe haven't been saved yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}

export default function RecipeFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined;
  const recordId = Number(id);
  const query = useRecipe(isEdit ? recordId : 0);
  const back = () => navigate("/recipes");

  if (!isEdit) {
    const preset = Number(params.get("product")) || undefined;
    return <RecipeForm key={preset ?? "new"} presetProduct={preset} />;
  }
  if (!validRecordId(recordId)) return <RecordLoadError name="recipe" invalidId error={undefined} retry={() => {}} back={back} />;
  if (query.isPending) {
    return (
      <div className="settings-form" aria-busy="true">
        <span className="skeleton block h-10 w-72" />
        <span className="skeleton mt-8 block h-28 w-full" aria-hidden="true" />
        <span className="skeleton mt-8 block h-64 w-full" aria-hidden="true" />
        <span className="sr-only" role="status">Loading the recipe</span>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <RecordLoadError name="recipe" invalidId={false} error={query.error} retry={() => void query.refetch()} back={back} />;
  }
  return <RecipeForm key={query.data.id} recipe={query.data} />;
}
