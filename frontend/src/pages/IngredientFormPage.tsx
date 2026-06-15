import { useEffect } from "react";
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
  quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
  unit: z.enum(["kg", "g", "ml", "l", "pcs", "tbsp", "tsp", "cup"]),
  cost_per_unit: z.coerce.number().min(0.01, "Cost per unit must be greater than ₱0"),
  minimum_stock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  supplier: z.string().optional(),
});

type IngredientForm = z.infer<typeof ingredientSchema>;

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

  const { data: ingredient, isLoading } = useIngredient(Number(id));
  const createIngredient = useCreateIngredient();
  const updateIngredient = useUpdateIngredient(Number(id));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IngredientForm>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: { minimum_stock: 0 },
  });

  useEffect(() => {
    if (ingredient) {
      reset({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        cost_per_unit: ingredient.cost_per_unit,
        supplier: ingredient.supplier,
        minimum_stock: ingredient.minimum_stock,
      });
    }
  }, [ingredient, reset]);

  const onSubmit = (data: IngredientForm) => {
    if (isEdit) {
      updateIngredient.mutate(data);
    } else {
      createIngredient.mutate(data);
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
