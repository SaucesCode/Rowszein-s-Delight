import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useIngredient,
  useCreateIngredient,
  useUpdateIngredient,
} from "@/hooks/useIngredients";
import type { Unit } from "@/types/ingredient.types";
import { INGREDIENT_CATEGORIES } from "@/types/ingredient.types";
import { ImageOff, Upload } from "lucide-react";
import SkeletonTable from "@/components/SkeletonTable";

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */
const UNITS: { value: Unit; label: string }[] = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "l", label: "Liter (l)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "cup", label: "Cup" },
  { value: "tbsp", label: "Tablespoon (tbsp)" },
  { value: "tsp", label: "Teaspoon (tsp)" },
  { value: "pcs", label: "Pieces (pcs)" },
];

/* ─────────────────────────────────────────────
   SCHEMA
   ───────────────────────────────────────────── */
const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  category: z.string().optional(),
  quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
  unit: z.enum(["kg", "g", "ml", "l", "pcs", "tbsp", "tsp", "cup"]),
  cost_per_unit: z.coerce.number().min(0.01, "Cost per unit must be greater than ₱0"),
  minimum_stock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

type IngredientFormInput = z.input<typeof ingredientSchema>;
type IngredientForm = z.output<typeof ingredientSchema>;

/* ─────────────────────────────────────────────
   FIELD — reusable labeled input block
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
export default function IngredientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: ingredient, isLoading } = useIngredient(Number(id));
  const createIngredient = useCreateIngredient();
  const updateIngredient = useUpdateIngredient(Number(id));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IngredientFormInput, unknown, IngredientForm>({
    resolver: zodResolver(ingredientSchema),
  });

  useEffect(() => {
    if (ingredient) {
      reset({
        name: ingredient.name,
        category: ingredient.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        cost_per_unit: ingredient.cost_per_unit,
        supplier: ingredient.supplier,
        minimum_stock: ingredient.minimum_stock,
        notes: ingredient.notes,
      });
      if (ingredient.image_url) setImagePreview(ingredient.image_url);
    }
  }, [ingredient, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const onSubmit = (data: IngredientForm) => {
    const payload = { ...data, image: imageFile };
    if (isEdit) {
      updateIngredient.mutate(payload);
    } else {
      createIngredient.mutate(payload);
    }
  };

  const isPending = createIngredient.isPending || updateIngredient.isPending;

  if (isEdit && isLoading) {
    return <SkeletonTable rows={4} cols={2} showHeader />;
  }

  return (
    <div className="max-w-400">
      {/* Form card */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="card-surface p-6 space-y-5"
      >
        {/* Image upload */}
        <div>
          <label className="field-label">
            Ingredient Image
            <span className="font-body ml-1" style={{ color: "#A8A49B", fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <div className="flex items-center gap-4 mt-1">
            <div
              className="flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0"
              style={{
                width: 64,
                height: 64,
                background: "#FFF0F7",
                border: "1.5px dashed #FFD6E7",
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Ingredient preview"
                  className="w-full h-full"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <ImageOff size={20} style={{ color: "#FF6FAE" }} aria-hidden="true" />
              )}
            </div>
            <label
              className="btn-ghost cursor-pointer"
              style={{ fontSize: 13, padding: "7px 14px" }}
            >
              <Upload size={14} aria-hidden="true" />
              {imagePreview ? "Change image" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="sr-only"
              />
            </label>
          </div>
          <p className="field-helper">
            PNG, JPG or WEBP. Used for quick visual identification.
          </p>
        </div>

        {/* Name */}
        <Field
          label="Ingredient Name"
          helper="Example: All Purpose Flour, Chocolate Chips"
          error={errors.name?.message}
          required
        >
          <input
            {...register("name")}
            className="field-input mt-1"
            placeholder="e.g. All Purpose Flour"
            autoFocus={!isEdit}
            aria-invalid={!!errors.name}
          />
        </Field>

        {/* Category */}
        <Field
          label="Category"
          helper="Groups this ingredient for filtering in the inventory list"
          error={errors.category?.message}
        >
          <select {...register("category")} className="field-input mt-1">
            <option value="">Uncategorized</option>
            {INGREDIENT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Quantity + Unit */}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Current Quantity"
            helper="How much you currently have in stock"
            error={errors.quantity?.message}
            required
          >
            <input
              {...register("quantity")}
              type="number"
              step="0.01"
              min="0"
              className="field-input mt-1"
              placeholder="0"
              aria-invalid={!!errors.quantity}
            />
          </Field>

          <Field
            label="Unit"
            helper="Measurement unit for this ingredient"
            error={errors.unit?.message}
            required
          >
            <select
              {...register("unit")}
              className="field-input mt-1"
              aria-invalid={!!errors.unit}
            >
              {UNITS.map(u => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Cost + Minimum stock */}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Cost per Unit (₱)"
            helper="How much one unit costs to purchase"
            error={errors.cost_per_unit?.message}
            required
          >
            <input
              {...register("cost_per_unit")}
              type="number"
              step="0.01"
              min="0"
              className="field-input mt-1"
              placeholder="0.00"
              aria-invalid={!!errors.cost_per_unit}
            />
          </Field>

          <Field
            label="Minimum Stock"
            helper="You'll get a low stock alert below this amount"
            error={errors.minimum_stock?.message}
          >
            <input
              {...register("minimum_stock")}
              type="number"
              step="0.01"
              min="0"
              className="field-input mt-1"
              placeholder="0"
              aria-invalid={!!errors.minimum_stock}
            />
          </Field>
        </div>

        {/* Supplier */}
        <Field
          label="Supplier"
          helper="Optional — where you buy this ingredient"
          error={errors.supplier?.message}
        >
          <input
            {...register("supplier")}
            className="field-input mt-1"
            placeholder="e.g. SM Supermarket, local market"
            aria-invalid={!!errors.supplier}
          />
        </Field>

        {/* Notes */}
        <Field
          label="Notes"
          helper="Optional — storage instructions, shelf life, brand preferences"
          error={errors.notes?.message}
        >
          <textarea
            {...register("notes")}
            rows={3}
            className="field-input mt-1"
            style={{ resize: "none" }}
            placeholder="e.g. Keep refrigerated, use within 2 weeks of opening…"
          />
        </Field>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #F5EDE0" }} />

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Saving…" : isEdit ? "Update Ingredient" : "Add Ingredient"}
          </button>
          <button type="button" onClick={() => navigate("/ingredients")} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
