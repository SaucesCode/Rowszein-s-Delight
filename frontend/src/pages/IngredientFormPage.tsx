import { useEffect, useId, useState, type ChangeEvent } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { useCreateIngredient, useDeleteIngredient, useIngredient, useUpdateIngredient } from "@/hooks/useIngredients";
import { INGREDIENT_CATEGORIES, type Ingredient, type Unit } from "@/types/ingredient.types";
import { stockQuanta } from "@/lib/stockQuantity";
import { formatAmount, unitLabel } from "@/lib/stockStatus";
import { validRecordId } from "@/lib/managementQueryKeys";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import Row from "@/components/ui/SettingsRow";

const UNITS: { value: Unit; label: string }[] = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "l", label: "Litres (L)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "pcs", label: "Pieces" },
  { value: "cup", label: "Cups" },
  { value: "tbsp", label: "Tablespoons" },
  { value: "tsp", label: "Teaspoons" },
];

const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Give the ingredient a name"),
  category: z.string().optional(),
  quantity: z.string().refine(text => {
    try {
      return stockQuanta(text.trim() || "0") >= 0n;
    } catch {
      return false;
    }
  }, "Use a plain number, like 25 or 2.5"),
  unit: z.enum(["kg", "g", "ml", "l", "pcs", "tbsp", "tsp", "cup"]),
  cost_per_unit: z.coerce.number({ error: "Enter what one unit costs" }).min(0.01, "Enter what one unit costs, more than ₱0"),
  minimum_stock: z.coerce.number({ error: "Use a plain number, like 5" }).min(0, "The restock level can't be below 0"),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof ingredientSchema>;
type FormOutput = z.output<typeof ingredientSchema>;

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_MB = 5;

function IngredientForm({ ingredient }: { ingredient?: Ingredient }) {
  const navigate = useNavigate();
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const isEdit = !!ingredient;

  const createIngredient = useCreateIngredient();
  const updateIngredient = useUpdateIngredient(ingredient?.id ?? 0);
  const deleteIngredient = useDeleteIngredient();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(ingredient?.image_url ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: ingredient
      ? {
          name: ingredient.name,
          category: ingredient.category || "other",
          quantity: String(ingredient.quantity),
          unit: ingredient.unit,
          cost_per_unit: ingredient.cost_per_unit,
          minimum_stock: ingredient.minimum_stock,
          supplier: ingredient.supplier || "",
          notes: ingredient.notes || "",
        }
      : {
          name: "",
          category: "other",
          quantity: "",
          unit: "kg",
          cost_per_unit: "",
          minimum_stock: 0,
          supplier: "",
          notes: "",
        },
  });

  const unit = useWatch({ control, name: "unit" });

  useEffect(() => {
    if (!photoFile || !photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoFile, photoPreview]);

  const isSaving = createIngredient.isPending || updateIngredient.isPending;
  const isDone =
    createIngredient.isSuccess || updateIngredient.isSuccess || deleteIngredient.isPending || deleteIngredient.isSuccess;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (isDirty || !!photoFile) && !isSaving && !isDone && currentLocation.pathname !== nextLocation.pathname,
  );

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setPhotoError("Choose a JPG, PNG or WEBP photo.");
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) return setPhotoError(`Choose a photo under ${PHOTO_MAX_MB} MB.`);
    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = (data: FormOutput) => {
    const payload = { ...data, name: data.name.trim(), quantity: data.quantity.trim() || "0", image: photoFile };
    if (ingredient) updateIngredient.mutate(payload);
    else createIngredient.mutate(payload);
  };

  const described = (name: keyof FormInput, hasHint = false) =>
    errors[name] || hasHint ? `${field(name)}-msg` : undefined;

  return (
    <>
      <form className="settings-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <header className="page-head">
          <div>
            <h1 className="type-page">{ingredient ? ingredient.name : "Add an ingredient"}</h1>
            <p className="page-lede">
              {ingredient
                ? "Change its details here. Stock goes up and down from the pantry."
                : "Tell us what it is and how much you have. You can change it later."}
            </p>
          </div>
        </header>

        <section className="settings-group" aria-labelledby={field("basics")}>
          <h2 id={field("basics")} className="settings-group-title">Basics</h2>
          <div className="settings-card">
            <Row label="Name" htmlFor={field("name")} error={errors.name?.message}>
              <input
                id={field("name")}
                className="field-input"
                placeholder="For example, Bread flour"
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={described("name")}
                {...register("name")}
              />
            </Row>
            <Row label="Category" htmlFor={field("category")}>
              <select id={field("category")} className="field-input" {...register("category")}>
                {INGREDIENT_CATEGORIES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Row>
            <Row label="Photo" hint={photoError ? undefined : "Optional. Helps staff pick the right bag."} error={photoError ?? undefined}>
              <div className="settings-photo">
                {photoPreview && <img src={photoPreview} alt="" />}
                <label className="btn-secondary settings-photo-button">
                  <ImagePlus size={18} aria-hidden="true" />
                  {photoPreview ? "Change photo" : "Add a photo"}
                  <input type="file" accept={PHOTO_TYPES.join(",")} className="sr-only" onChange={handlePhoto} />
                </label>
              </div>
            </Row>
          </div>
        </section>

        <section className="settings-group" aria-labelledby={field("stock")}>
          <h2 id={field("stock")} className="settings-group-title">Stock</h2>
          <div className="settings-card">
            <Row
              label="Measured in"
              htmlFor={field("unit")}
              hint={isEdit ? "Can only change before any stock has been recorded." : undefined}
            >
              <select
                id={field("unit")}
                className="field-input"
                aria-describedby={described("unit", isEdit)}
                {...register("unit")}
              >
                {UNITS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Row>
            {ingredient ? (
              <Row label="In stock now">
                <p className="settings-readout num">{formatAmount(ingredient.quantity, ingredient.unit)}</p>
                <p className="field-hint">
                  To add a delivery or take some out, use{" "}
                  <Link to={`/ingredients?item=${ingredient.id}`} className="settings-link">Update stock in the pantry</Link>.
                </p>
              </Row>
            ) : (
              <Row
                label="How much you have"
                htmlFor={field("quantity")}
                error={errors.quantity?.message}
                hint="Leave empty if you have none yet."
              >
                <div className="settings-unit-input">
                  <input
                    id={field("quantity")}
                    className="field-input num"
                    inputMode="decimal"
                    placeholder="0"
                    aria-invalid={!!errors.quantity}
                    aria-describedby={described("quantity", true)}
                    {...register("quantity")}
                  />
                  <span aria-hidden="true">{unitLabel(unit)}</span>
                </div>
              </Row>
            )}
            <Row
              label="Restock at"
              htmlFor={field("minimum_stock")}
              error={errors.minimum_stock?.message}
              hint="When stock drops to this amount, it shows as running low."
            >
              <div className="settings-unit-input">
                <input
                  id={field("minimum_stock")}
                  className="field-input num"
                  inputMode="decimal"
                  aria-invalid={!!errors.minimum_stock}
                  aria-describedby={described("minimum_stock", true)}
                  {...register("minimum_stock")}
                />
                <span aria-hidden="true">{unitLabel(unit)}</span>
              </div>
            </Row>
          </div>
        </section>

        <section className="settings-group" aria-labelledby={field("cost")}>
          <h2 id={field("cost")} className="settings-group-title">Cost and supplier</h2>
          <div className="settings-card">
            <Row
              label={`Cost per ${unitLabel(unit)}`}
              htmlFor={field("cost_per_unit")}
              error={errors.cost_per_unit?.message}
              hint="Used to work out what each donut costs to make."
            >
              <div className="settings-unit-input is-prefix">
                <span aria-hidden="true">₱</span>
                <input
                  id={field("cost_per_unit")}
                  className="field-input num"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-invalid={!!errors.cost_per_unit}
                  aria-describedby={described("cost_per_unit", true)}
                  {...register("cost_per_unit")}
                />
              </div>
            </Row>
            <Row label="Supplier" htmlFor={field("supplier")} hint="Optional.">
              <input
                id={field("supplier")}
                className="field-input"
                placeholder="For example, Manila Flour Mills"
                aria-describedby={described("supplier", true)}
                {...register("supplier")}
              />
            </Row>
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
              placeholder="Storage tips, brand to buy, anything worth remembering."
              {...register("notes")}
            />
          </div>
        </section>

        {ingredient && (
          <section className="settings-group" aria-label="Delete">
            <div className="settings-card">
              <button type="button" className="settings-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={18} aria-hidden="true" />
                Delete ingredient
              </button>
            </div>
          </section>
        )}

        <footer className="settings-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate("/ingredients")}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving} aria-busy={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add to pantry"}
          </button>
        </footer>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${ingredient?.name ?? "this ingredient"}?`}
        description="It will be removed from the pantry, and this can't be undone. Ingredients used in a recipe or with stock history can't be deleted."
        confirmLabel="Delete ingredient"
        cancelLabel="Keep it"
        destructive
        loading={deleteIngredient.isPending}
        onConfirm={() =>
          ingredient && deleteIngredient.mutate(ingredient.id, { onSuccess: () => navigate("/ingredients") })
        }
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description="Your changes to this ingredient haven't been saved yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="settings-form" aria-busy="true">
      <span className="skeleton block h-10 w-72" />
      {Array.from({ length: 3 }, (_, index) => (
        <span key={index} className="skeleton mt-8 block h-40 w-full" aria-hidden="true" />
      ))}
      <span className="sr-only" role="status">Loading the ingredient</span>
    </div>
  );
}

export default function IngredientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined;
  const recordId = Number(id);
  const query = useIngredient(isEdit ? recordId : 0);
  const back = () => navigate("/ingredients");

  if (!isEdit) return <IngredientForm />;
  if (!validRecordId(recordId)) {
    return <RecordLoadError name="ingredient" invalidId error={undefined} retry={() => {}} back={back} />;
  }
  if (query.isPending) return <FormSkeleton />;
  if (query.isError || !query.data) {
    return (
      <RecordLoadError name="ingredient" invalidId={false} error={query.error} retry={() => void query.refetch()} back={back} />
    );
  }
  return <IngredientForm key={query.data.id} ingredient={query.data} />;
}
