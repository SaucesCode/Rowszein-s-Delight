import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProduct, useCreateProduct, useUpdateProduct } from "@/hooks/useProducts";
import { ImageOff, Upload } from "lucide-react";
import SkeletonTable from "@/components/SkeletonTable";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0.01, "Price must be greater than ₱0"),
  is_available: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

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

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: product, isLoading } = useProduct(Number(id));
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(Number(id));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { is_available: true },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description,
        price: product.price,
        is_available: product.is_available,
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
            {/* Preview box */}
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
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageOff size={20} style={{ color: "#FF6FAE" }} aria-hidden="true" />
              )}
            </div>

            {/* Upload button */}
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

        {/* Price */}
        <Field
          label="Selling Price (₱)"
          helper="The price shown to customers"
          error={errors.price?.message}
          required
        >
          <input
            {...register("price")}
            type="number"
            step="0.01"
            min="0"
            className="field-input mt-1"
            placeholder="0.00"
            aria-invalid={!!errors.price}
          />
        </Field>

        {/* Availability toggle */}
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "#FFF8F0", border: "1px solid #F5EDE0" }}
        >
          <div>
            <p className="font-heading font-medium" style={{ fontSize: 13, color: "#6B4226" }}>
              Available for sale
            </p>
            <p className="font-body" style={{ fontSize: 12, color: "#9B6644" }}>
              Customers can order this product
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input {...register("is_available")} type="checkbox" className="sr-only peer" />
            <div
              className="w-10 h-5 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:rounded-full after:h-4 after:w-4 after:transition-transform"
              style={{
                background: "var(--border)",
              }}
              aria-hidden="true"
            />
          </label>
          {/* Simpler checkbox since Tailwind peer might need config */}
          <input
            {...register("is_available")}
            type="checkbox"
            id="is_available"
            className="w-4 h-4 rounded"
            style={{ accentColor: "#FF6FAE" }}
          />
          <style>{`input[type=checkbox] { display: none; } input[type=checkbox]:last-of-type { display: block; }`}</style>
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
