import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCategories,
  useCreateProduct,
  useProduct,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { ImageOff, Upload } from "lucide-react";
import SkeletonTable from "@/components/SkeletonTable";
import type { Category } from "@/types/product.types";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.number().min(0.01, "Price must be greater than ₱0"),
  category_id: z.number().min(1, "Category is required"),
  is_available: z.boolean(),
  is_featured: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

interface DuplicateState {
  name?: string;
  description?: string;
  price?: number;
  category_id?: number;
}

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
   TOGGLE ROW — reusable labeled boolean toggle
   ───────────────────────────────────────────── */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: "#FFF8F0", border: "1px solid #F5EDE0" }}
    >
      <div>
        <p className="font-heading font-medium" style={{ fontSize: 13, color: "#6B4226" }}>
          {label}
        </p>
        <p className="font-body" style={{ fontSize: 12, color: "#9B6644" }}>
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 rounded-full transition-colors duration-200"
        style={{
          width: 40,
          height: 22,
          background: checked
            ? "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)"
            : "#E8E6E1",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span
          className="absolute rounded-full transition-transform duration-200"
          style={{
            width: 16,
            height: 16,
            top: 3,
            left: checked ? 21 : 3,
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
      </button>
    </div>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;

  // Populated only when arriving via the Products list's "Duplicate" action
  // (see ProductsPage.handleDuplicate). Image is intentionally not carried
  // over — cloning a File from a remote URL adds real complexity for a
  // rare action; the owner re-attaches an image if needed.
  const duplicateData = !isEdit
    ? (location.state as { duplicate?: DuplicateState } | null)?.duplicate
    : undefined;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: product, isLoading } = useProduct(Number(id));
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(Number(id));
  const categories: Category[] = categoriesData?.data ?? [];
  const defaultCategoryId =
    duplicateData?.category_id ?? categories.find(category => category.is_active)?.id ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      is_available: true,
      is_featured: false,
      category_id: defaultCategoryId,
      name: duplicateData?.name,
      description: duplicateData?.description,
      price: duplicateData?.price,
    },
  });

  const isAvailable = watch("is_available");
  const isFeatured = watch("is_featured");
  const selectedCategoryId = watch("category_id");

  useEffect(() => {
    if (!isEdit && !selectedCategoryId && defaultCategoryId) {
      setValue("category_id", defaultCategoryId);
    }
  }, [defaultCategoryId, isEdit, selectedCategoryId, setValue]);

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description,
        price: Number(product.price),
        category_id: product.category.id,
        is_available: product.is_available,
        is_featured: product.is_featured,
      });
      if (product.image_url) setImagePreview(product.image_url);
    }
  }, [product, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const onSubmit = (data: ProductForm) => {
    const payload = { ...data, image: imageFile };
    if (isEdit) {
      updateProduct.mutate(payload);
    } else {
      createProduct.mutate(payload);
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  if (isEdit && isLoading) {
    return <SkeletonTable rows={4} cols={2} showHeader />;
  }

  return (
    <div className="max-w-400">
      {duplicateData && (
        <div
          className="mb-4 px-4 py-3 rounded-xl animate-fade-in"
          style={{ background: "#FFF0F7", border: "1px solid #FFD6E7" }}
        >
          <p className="font-body" style={{ fontSize: 13, color: "#993556" }}>
            Duplicating from an existing product — review the details below, then add a new
            image.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="card-surface p-6 space-y-5"
      >
        {/* Image upload */}
        <div>
          <label className="field-label">
            Product Image
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
                  alt="Product preview"
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
          <p className="field-helper">PNG, JPG or WEBP. Recommended: square format.</p>
        </div>

        {/* Name */}
        <Field
          label="Product Name"
          helper="Example: Chocolate Donut, Strawberry Cheesecake"
          error={errors.name?.message}
          required
        >
          <input
            {...register("name")}
            className="field-input mt-1"
            placeholder="e.g. Chocolate Donut"
            autoFocus={!isEdit}
            aria-invalid={!!errors.name}
          />
        </Field>

        {/* Description */}
        <Field
          label="Description"
          helper="Briefly describe the product — flavors, toppings, special notes"
          error={errors.description?.message}
        >
          <textarea
            {...register("description")}
            rows={3}
            className="field-input mt-1"
            style={{ resize: "none" }}
            placeholder="Describe the product…"
          />
        </Field>

        <Field
          label="Category"
          helper="Which menu section this product appears under"
          error={errors.category_id?.message}
          required
        >
          <select
            {...register("category_id", { valueAsNumber: true })}
            className="field-input mt-1"
            aria-invalid={!!errors.category_id}
            disabled={categoriesLoading || categories.length === 0}
          >
            <option value={0}>
              {categoriesLoading ? "Loading categories..." : "Select a category..."}
            </option>
            {categories
              .filter(category => category.is_active)
              .map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </Field>

        {/* Price */}
        <Field
          label="Selling Price (₱)"
          helper="The price shown to customers"
          error={errors.price?.message}
          required
        >
          <input
            {...register("price", { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            className="field-input mt-1"
            placeholder="0.00"
            aria-invalid={!!errors.price}
          />
        </Field>

        {/* Availability + Featured toggles */}
        <div className="space-y-3">
          <ToggleRow
            label="Available for sale"
            description="Customers can see and order this product"
            checked={isAvailable}
            onChange={val => setValue("is_available", val)}
          />
          <ToggleRow
            label="Featured / Bestseller"
            description="Shows in the Bestsellers section on the public shop page"
            checked={isFeatured}
            onChange={val => setValue("is_featured", val)}
          />
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #F5EDE0" }} />

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Saving…" : isEdit ? "Update Product" : "Add Product"}
          </button>
          <button type="button" onClick={() => navigate("/products")} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
