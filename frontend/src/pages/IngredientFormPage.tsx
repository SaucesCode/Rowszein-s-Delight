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

const UNITS: Unit[] = ["kg", "g", "ml", "l", "pcs", "tbsp", "tsp", "cup"];

const ingredientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
  unit: z.enum(["kg", "g", "ml", "l", "pcs", "tbsp", "tsp", "cup"]),
  cost_per_unit: z.coerce.number().min(0.01, "Cost must be greater than 0"),
  supplier: z.string().optional(),
});

type IngredientForm = z.infer<typeof ingredientSchema>;

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
  });

  useEffect(() => {
    if (ingredient) {
      reset({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        cost_per_unit: ingredient.cost_per_unit,
        supplier: ingredient.supplier,
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
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">
          {isEdit ? "Edit Ingredient" : "Add Ingredient"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEdit ? "Update ingredient details" : "Add a new ingredient to inventory"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            {...register("name")}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="e.g. All Purpose Flour"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input
              {...register("quantity")}
              type="number"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="0"
            />
            {errors.quantity && (
              <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
            <select
              {...register("unit")}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            >
              {UNITS.map(unit => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Cost per Unit (₱)
          </label>
          <input
            {...register("cost_per_unit")}
            type="number"
            step="0.01"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="0.00"
          />
          {errors.cost_per_unit && (
            <p className="text-xs text-red-500 mt-1">{errors.cost_per_unit.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Supplier <span className="text-slate-400">(optional)</span>
          </label>
          <input
            {...register("supplier")}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="e.g. SM Supermarket"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEdit ? "Update Ingredient" : "Add Ingredient"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/ingredients")}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
