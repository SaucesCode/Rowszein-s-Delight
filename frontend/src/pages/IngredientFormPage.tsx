import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useIngredient,
  useCreateIngredient,
  useUpdateIngredient,
  useDeleteIngredient,
} from "@/hooks/useIngredients";
import type { Unit } from "@/types/ingredient.types";
import { INGREDIENT_CATEGORIES } from "@/types/ingredient.types";
import { Upload, Trash2, Package } from "lucide-react";
import SkeletonTable from "@/components/SkeletonTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { stockQuanta } from "@/lib/stockQuantity";
import { validRecordId } from "@/lib/managementQueryKeys";
import RecordLoadError from "@/components/RecordLoadError";
import { ArrowLeftIcon, CheckIcon } from "@/pages/owner-home/OwnerHomeIcons";

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */
const UNITS: { value: Unit; label: string }[] = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "l", label: "Liter (l)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "cup", label: "Cup" },
  { value: "tbsp", label: "Tablespoon (tbsp)" },
  { value: "tsp", label: "Teaspoon (tsp)" },
];

/* ─────────────────────────────────────────────
   SCHEMA
   ───────────────────────────────────────────── */
const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  category: z.string().optional(),
  quantity: z.string().refine((text) => {
    try { return stockQuanta(text) >= 0n; } catch { return false; }
  }, "Use a nonnegative quantity with at most nine decimal places within the supported range."),
  unit: z.enum(["kg", "g", "ml", "l", "pcs", "tbsp", "tsp", "cup"]),
  cost_per_unit: z.coerce.number().min(0.01, "Cost per unit must be greater than ₱0"),
  minimum_stock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

type IngredientFormInput = z.input<typeof ingredientSchema>;
type IngredientForm = z.output<typeof ingredientSchema>;

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function IngredientFormPage() {
  const { id } = useParams();
  return <IngredientForm key={id ?? "new"} id={id} />;
}

function IngredientForm({ id }: { id: string | undefined }) {
  const navigate = useNavigate();
  const isEdit = !!id;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: ingredient, isPending: detailPending, isError, error, refetch } = useIngredient(Number(id));
  const imagePreview = uploadedPreview ?? ingredient?.image_url ?? null;
  const createIngredient = useCreateIngredient();
  const updateIngredient = useUpdateIngredient(Number(id));
  const deleteIngredient = useDeleteIngredient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IngredientFormInput, unknown, IngredientForm>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      category: "flour_grains",
      unit: "kg",
      quantity: "0",
      minimum_stock: 0,
      cost_per_unit: 50,
      supplier: "",
      notes: "",
    },
  });

  const selectedCategory = watch("category");
  const selectedUnit = watch("unit");

  useEffect(() => {
    if (ingredient) {
      reset({
        name: ingredient.name,
        category: ingredient.category || "flour_grains",
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
        cost_per_unit: ingredient.cost_per_unit,
        supplier: ingredient.supplier || "",
        minimum_stock: ingredient.minimum_stock,
        notes: ingredient.notes || "",
      });
    }
  }, [ingredient, reset]);

  useEffect(() => () => {
    if (uploadedPreview) URL.revokeObjectURL(uploadedPreview);
  }, [uploadedPreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setUploadedPreview(URL.createObjectURL(file));
  };

  const onSubmit = (data: IngredientForm) => {
    const payload = { ...data, image: imageFile };
    if (isEdit) {
      updateIngredient.mutate(payload, {
        onSuccess: () => navigate("/ingredients"),
      });
    } else {
      createIngredient.mutate(payload, {
        onSuccess: () => navigate("/ingredients"),
      });
    }
  };

  const handleDelete = () => {
    if (!id) return;
    deleteIngredient.mutate(Number(id), {
      onSuccess: () => navigate("/ingredients"),
    });
  };

  const isPending = createIngredient.isPending || updateIngredient.isPending;

  if (isEdit && !validRecordId(Number(id))) {
    return <RecordLoadError name="ingredient" invalidId error={undefined} retry={() => {}} back={() => navigate("/ingredients")} />;
  }
  if (isEdit && detailPending) {
    return <SkeletonTable rows={4} cols={2} showHeader />;
  }
  if (isEdit && (isError || !ingredient)) {
    return <RecordLoadError name="ingredient" invalidId={false} error={error} retry={() => { void refetch(); }} back={() => navigate("/ingredients")} />;
  }

  return (
    <div className="subview-shell">
      {/* ─── Subview Header Strip (Breadcrumb + Title) ─── */}
      <section className="owner-subview-header">
        <div className="owner-subview-left">
          <Link to="/ingredients" className="owner-back-btn" aria-label="Back to Ingredient Inventory">
            <ArrowLeftIcon width={14} height={14} />
            <span>Back to Ingredients</span>
          </Link>
          <div className="owner-subview-title-group">
            <h1 className="owner-subview-title">
              {isEdit ? `Edit: ${ingredient?.name ?? "Ingredient"}` : "Add New Ingredient"}
            </h1>
            <span className="owner-count-pill">
              {isEdit ? "Pantry Modification" : "New Raw Supply"}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Boutique Form Card (Full Width with Generous Spacing) ─── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="bg-white rounded-3xl shadow-sm overflow-hidden"
        style={{ border: "1px solid var(--ol-card-border, #F5D5E2)" }}
      >
        <div className="p-8 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-10 lg:gap-14">
          {/* ─── Left Column: Image & Unit Preview ─── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#2B1820", letterSpacing: "0.06em" }}
              >
                Ingredient Photo
              </label>
              <span className="text-xs text-gray-400">Optional</span>
            </div>

            {/* Photo Box */}
            <div
              className="w-full max-w-[340px] aspect-square rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all mx-auto lg:mx-0"
              style={{
                background: "linear-gradient(135deg, #FFF9FB 0%, #FFF0F5 100%)",
                border: "2px dashed #F5CADB",
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Ingredient Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: "#FFE6F0", color: "#C7255E" }}
                  >
                    <Package size={32} strokeWidth={2.2} />
                  </div>
                  <span
                    className="font-bold text-sm"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C7255E" }}
                  >
                    Upload Supply Photo
                  </span>
                  <span className="text-xs text-gray-400 mt-1">Packaging, canister, or raw bulk photo</span>
                </div>
              )}
            </div>

            {/* Choose File Button */}
            <label
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-all bg-white shadow-sm w-full max-w-[340px] mx-auto lg:mx-0"
              style={{ border: "1px solid #F5D5E2", color: "#C7255E" }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#FFE6F0";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#FFFFFF";
              }}
            >
              <Upload size={14} strokeWidth={2.5} />
              <span>{imagePreview ? "Change Photo File" : "Choose Photo File"}</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
            </label>

            {/* Measurement Unit Selector */}
            <div className="w-full max-w-[340px] mx-auto lg:mx-0 pt-2">
              <label
                htmlFor="unit-select"
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: "#2B1820" }}
              >
                Measurement Unit <span style={{ color: "#C7255E" }}>*</span>
              </label>
              <select
                id="unit-select"
                {...register("unit")}
                className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-all font-semibold cursor-pointer"
                style={{
                  background: "#FFFDFE",
                  border: errors.unit ? "1.5px solid #EF4444" : "1px solid #F1D3E0",
                  color: "#2B1820",
                }}
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">Used for recipes, costing, and inventory tracking.</p>
            </div>
          </div>

          {/* ─── Right Column: Form Fields with Generous Spacing ─── */}
          <div className="flex flex-col gap-6">
            {/* Ingredient Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
              >
                Ingredient Name <span style={{ color: "#C7255E" }}>*</span>
              </label>
              <input
                id="name"
                {...register("name")}
                placeholder="e.g. High-Grade Japanese Bread Flour"
                className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-all font-medium"
                style={{
                  background: "#FFFDFE",
                  border: errors.name ? "1.5px solid #EF4444" : "1px solid #F1D3E0",
                  color: "#2B1820",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#C7255E";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.name ? "#EF4444" : "#F1D3E0";
                  e.currentTarget.style.boxShadow = "none";
                }}
                aria-invalid={!!errors.name}
              />
              {errors.name ? (
                <p className="text-xs text-red-500 mt-1.5">{errors.name.message}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1.5">Official item title displayed on pantry ledgers and recipes.</p>
              )}
            </div>

            {/* Category Chips */}
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
              >
                Pantry Category <span style={{ color: "#C7255E" }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2.5">
                {INGREDIENT_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setValue("category", cat.value, { shouldValidate: true })}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        background: isSelected ? "#C7255E" : "#FFFFFF",
                        color: isSelected ? "#FFFFFF" : "#7E6570",
                        border: isSelected ? "1px solid #C7255E" : "1px solid #F5D5E2",
                        boxShadow: isSelected ? "0 2px 8px rgba(199, 37, 94, 0.25)" : "none",
                      }}
                    >
                      {isSelected && <CheckIcon width={12} height={12} />}
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity & Minimum Reorder Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="quantity"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                >
                  {isEdit ? "Current Stock (Read-Only)" : "Initial Stock Quantity"} <span style={{ color: "#C7255E" }}>*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="quantity"
                    {...register("quantity")}
                    readOnly={isEdit}
                    type="number"
                    step="0.000000001"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-4 py-3 text-sm rounded-xl outline-none font-bold transition-all"
                    style={{
                      background: isEdit ? "#F9FAFB" : "#FFFDFE",
                      border: errors.quantity ? "1.5px solid #EF4444" : "1px solid #F1D3E0",
                      color: isEdit ? "#6B7280" : "#2B1820",
                    }}
                    aria-invalid={!!errors.quantity}
                  />
                  <span className="absolute right-4 text-xs font-bold text-gray-400 uppercase pointer-events-none">
                    {selectedUnit}
                  </span>
                </div>
                {errors.quantity ? (
                  <p className="text-xs text-red-500 mt-1.5">{errors.quantity.message}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1.5">
                    {isEdit ? "To modify stock, use the Adjust Stock modal on the inventory table." : "Starting raw inventory on hand."}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="minimum_stock"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                >
                  Minimum Reorder Alert Level
                </label>
                <div className="relative flex items-center">
                  <input
                    id="minimum_stock"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("minimum_stock")}
                    placeholder="0.00"
                    className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-all font-semibold"
                    style={{ background: "#FFFDFE", border: "1px solid #F1D3E0", color: "#2B1820" }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#C7255E";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#F1D3E0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <span className="absolute right-4 text-xs font-bold text-gray-400 uppercase pointer-events-none">
                    {selectedUnit}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">You will get a Low Stock alert when balance falls below this.</p>
              </div>
            </div>

            {/* Unit Purchase Cost & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="cost_per_unit"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                >
                  Purchase Cost Per Unit (₱) <span style={{ color: "#C7255E" }}>*</span>
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-4 font-extrabold pointer-events-none"
                    style={{ color: "#C7255E", fontSize: "1rem" }}
                  >
                    ₱
                  </span>
                  <input
                    id="cost_per_unit"
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...register("cost_per_unit")}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-3 text-sm rounded-xl outline-none font-bold transition-all"
                    style={{
                      background: "#FFFDFE",
                      border: errors.cost_per_unit ? "1.5px solid #EF4444" : "1px solid #F1D3E0",
                      color: "#2B1820",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#C7255E";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = errors.cost_per_unit ? "#EF4444" : "#F1D3E0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    aria-invalid={!!errors.cost_per_unit}
                  />
                </div>
                {errors.cost_per_unit ? (
                  <p className="text-xs text-red-500 mt-1.5">{errors.cost_per_unit.message}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1.5">Exact unit acquisition cost for recipe calculations.</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="supplier"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                >
                  Primary Supplier / Vendor
                </label>
                <input
                  id="supplier"
                  type="text"
                  {...register("supplier")}
                  placeholder="e.g. Manila Flour Mills, Inc."
                  className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-all"
                  style={{ background: "#FFFDFE", border: "1px solid #F1D3E0", color: "#2B1820" }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#C7255E";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#F1D3E0";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <p className="text-xs text-gray-500 mt-1.5">Preferred vendor name or store location.</p>
              </div>
            </div>

            {/* Storage Notes & Brand Preferences */}
            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
              >
                Storage Notes &amp; Shelf Life
              </label>
              <textarea
                id="notes"
                {...register("notes")}
                rows={3}
                placeholder="e.g. Store in dry airtight container, keep chilled after opening, 6 months shelf life…"
                className="w-full px-4 py-3 text-sm rounded-xl outline-none resize-none transition-all leading-relaxed"
                style={{ background: "#FFFDFE", border: "1px solid #F1D3E0", color: "#2B1820" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#C7255E";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#F1D3E0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── Form Card Footer Actions ─── */}
        <div
          className="px-8 sm:px-10 lg:px-12 py-5 flex items-center justify-between gap-3"
          style={{ background: "#FFFDFE", borderTop: "1px solid #F8EBF1" }}
        >
          {isEdit ? (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all border-none cursor-pointer"
              style={{ background: "#FEF2F2", color: "#DC2626" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#FEE2E2")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#FEF2F2")}
            >
              <Trash2 size={14} strokeWidth={2.5} />
              <span>Delete Ingredient</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/ingredients")}
              className="px-5 py-2.5 rounded-full text-xs font-semibold transition-all bg-transparent cursor-pointer"
              style={{ border: "1px solid #F5D5E2", color: "#7E6570" }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#F3F4F6";
                e.currentTarget.style.color = "#2B1820";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#7E6570";
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="owner-action-btn-primary cursor-pointer"
              style={{ opacity: isPending ? 0.7 : 1 }}
            >
              <CheckIcon width={14} height={14} />
              <span>{isPending ? "Saving Ingredient…" : isEdit ? "Update Ingredient" : "Save Ingredient"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Pantry Ingredient?"
        description={`Are you sure you want to permanently delete "${ingredient?.name}"? Any baking recipes or formulations referencing this ingredient may be impacted.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        destructive={true}
        loading={deleteIngredient.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
