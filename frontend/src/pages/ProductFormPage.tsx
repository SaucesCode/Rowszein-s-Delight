import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCategories,
  useCreateProduct,
  useDeleteProduct,
  useProduct,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { Upload, Trash2 } from "lucide-react";
import SkeletonTable from "@/components/SkeletonTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { Category } from "@/types/product.types";
import { ArrowLeftIcon, StarIcon, CheckIcon } from "@/pages/owner-home/OwnerHomeIcons";

const productSchema = z.object({
  name: z.string().min(1, "Donut name is required"),
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

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;

  const duplicateData = !isEdit
    ? (location.state as { duplicate?: DuplicateState } | null)?.duplicate
    : undefined;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: product, isLoading } = useProduct(Number(id));
  const { data: categoriesData } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(Number(id));
  const deleteProduct = useDeleteProduct();
  const categories: Category[] = categoriesData?.data ?? [];

  const defaultCategoryId =
    duplicateData?.category_id ?? categories.find((cat) => cat.is_active)?.id ?? 0;

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
      name: duplicateData?.name ?? "",
      description: duplicateData?.description ?? "",
      price: duplicateData?.price ?? 45,
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
      updateProduct.mutate(payload, {
        onSuccess: () => navigate("/products"),
      });
    } else {
      createProduct.mutate(payload, {
        onSuccess: () => navigate("/products"),
      });
    }
  };

  const handleDelete = () => {
    if (!id) return;
    deleteProduct.mutate(Number(id), {
      onSuccess: () => navigate("/products"),
    });
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  if (isEdit && isLoading) {
    return <SkeletonTable rows={4} cols={2} showHeader />;
  }

  return (
    <div className="subview-shell">
      {/* ─── Subview Header Strip (Breadcrumb + Title) ─── */}
      <section className="owner-subview-header">
        <div className="owner-subview-left">
          <Link to="/products" className="owner-back-btn" aria-label="Back to Donut Products">
            <ArrowLeftIcon width={14} height={14} />
            <span>Back to Products</span>
          </Link>
          <div className="owner-subview-title-group">
            <h1 className="owner-subview-title">
              {isEdit ? `Edit: ${product?.name ?? "Donut"}` : "Add New Donut"}
            </h1>
            <span className="owner-count-pill">
              {isEdit ? "Catalog Modification" : "New Creation"}
            </span>
          </div>
        </div>
      </section>

      {/* Duplicate Notice */}
      {duplicateData && (
        <div
          className="px-4 py-3 rounded-2xl flex items-center gap-2"
          style={{ background: "#FFE6F0", border: "1px solid #F5D5E2", color: "#C7255E" }}
        >
          <span className="text-xs font-semibold">
            Duplicating from an existing donut — review details below, then optionally upload a new photo.
          </span>
        </div>
      )}

      {/* ─── Boutique Form Card (Full Width with Generous Spacing) ─── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="bg-white rounded-3xl shadow-sm overflow-hidden"
        style={{ border: "1px solid var(--ol-card-border, #F5D5E2)" }}
      >
        <div className="p-8 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-10 lg:gap-14">
          {/* ─── Left Column: Donut Photo Uploader ─── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#2B1820", letterSpacing: "0.06em" }}
              >
                Donut Photo
              </label>
              <span className="text-xs text-gray-400">Optional</span>
            </div>

            {/* Photo Box */}
            <div
              className="w-full max-w-[340px] aspect-square rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all mx-auto lg:mx-0"
              style={{
                background: "linear-gradient(135deg, #FFF0F5 0%, #FFE6F0 100%)",
                border: "2px dashed #F5CADB",
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Donut Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <svg width="84" height="84" viewBox="0 0 48 48" fill="none" className="mb-3" aria-hidden="true">
                    <circle cx="24" cy="24" r="19" fill="#F8C08A" />
                    <circle cx="24" cy="24" r="18" fill="#FF8BB5" />
                    <path
                      d="M10 21c2 0 3 4 5 4s3-4 5-4 3 4 5 4 3-4 5-4 3 4 5 4"
                      stroke="#FFF0F5"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="24" cy="24" r="7" fill="#FFE5EE" />
                    <circle cx="24" cy="24" r="7" stroke="#E07936" strokeWidth="1.5" />
                    <rect x="17" y="14" width="4" height="1.5" rx="0.75" fill="#FFFFFF" transform="rotate(25 17 14)" />
                    <rect x="27" y="15" width="4" height="1.5" rx="0.75" fill="#FFE600" transform="rotate(-30 27 15)" />
                    <rect x="31" y="25" width="4" height="1.5" rx="0.75" fill="#FFFFFF" transform="rotate(45 31 25)" />
                    <rect x="15" y="27" width="4" height="1.5" rx="0.75" fill="#70D6FF" transform="rotate(10 15 27)" />
                  </svg>
                  <span
                    className="font-bold text-sm"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C7255E" }}
                  >
                    Upload Donut Photo
                  </span>
                  <span className="text-xs text-gray-500 mt-1">Drop image or click below</span>
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

            <p className="text-xs text-center lg:text-left text-gray-400 leading-relaxed max-w-[340px]">
              Square JPG, PNG, or WEBP. If no custom photo is added, your signature glaze illustration will display automatically across the catalog.
            </p>
          </div>

          {/* ─── Right Column: Form Fields with Generous Spacing ─── */}
          <div className="flex flex-col gap-6">
            {/* Donut Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
              >
                Donut Name <span style={{ color: "#C7255E" }}>*</span>
              </label>
              <input
                id="name"
                {...register("name")}
                placeholder="e.g. Wild Strawberry Glazed Delight"
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
                <p className="text-xs text-gray-500 mt-1.5">Give your creation an appetizing, customer-friendly title.</p>
              )}
            </div>

            {/* Category Chips */}
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
              >
                Category <span style={{ color: "#C7255E" }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2.5">
                {categories
                  .filter((cat) => cat.is_active)
                  .map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setValue("category_id", cat.id, { shouldValidate: true })}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer"
                        style={{
                          background: isSelected ? "#C7255E" : "#FFFFFF",
                          color: isSelected ? "#FFFFFF" : "#7E6570",
                          border: isSelected ? "1px solid #C7255E" : "1px solid #F5D5E2",
                          boxShadow: isSelected ? "0 2px 8px rgba(199, 37, 94, 0.25)" : "none",
                        }}
                      >
                        {isSelected && <CheckIcon width={12} height={12} />}
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
              </div>
              {errors.category_id && (
                <p className="text-xs text-red-500 mt-1.5">{errors.category_id.message}</p>
              )}
            </div>

            {/* Price & Optional Batch Target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="price"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                >
                  Selling Price (₱) <span style={{ color: "#C7255E" }}>*</span>
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-4 font-extrabold pointer-events-none"
                    style={{ color: "#C7255E", fontSize: "1rem" }}
                  >
                    ₱
                  </span>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...register("price", { valueAsNumber: true })}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-3 text-sm rounded-xl outline-none font-bold transition-all"
                    style={{
                      background: "#FFFDFE",
                      border: errors.price ? "1.5px solid #EF4444" : "1px solid #F1D3E0",
                      color: "#2B1820",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#C7255E";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = errors.price ? "#EF4444" : "#F1D3E0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    aria-invalid={!!errors.price}
                  />
                </div>
                {errors.price ? (
                  <p className="text-xs text-red-500 mt-1.5">{errors.price.message}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1.5">Retail customer price per piece.</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="batch"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                >
                  Daily Batch Target <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  id="batch"
                  type="text"
                  placeholder="e.g. 48 pcs"
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
                <p className="text-xs text-gray-500 mt-1.5">Standard morning bake target for kitchen staff.</p>
              </div>
            </div>

            {/* Flavor Profile & Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
              >
                Flavor Profile &amp; Description
              </label>
              <textarea
                id="description"
                {...register("description")}
                rows={4}
                placeholder="Describe flavors, signature glazes, brioche dough texture, and toppings…"
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
              <p className="text-xs text-gray-500 mt-1.5">Displayed on customer shop card and product detail dialogs.</p>
            </div>

            {/* ─── Storefront & Bestseller Switches (2 Cards Side-by-Side) ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="p-5 rounded-2xl flex items-center justify-between gap-4"
                style={{ background: "#FFF9FB", border: "1px solid #F5D5E2" }}
              >
                <div>
                  <span
                    className="block text-xs font-bold mb-0.5"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                  >
                    Live in Storefront
                  </span>
                  <span className="text-xs text-gray-500">
                    Visible to customers for online ordering.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAvailable}
                  onClick={() => setValue("is_available", !isAvailable)}
                  className="relative flex-shrink-0 rounded-full transition-colors duration-200 border-none cursor-pointer"
                  style={{
                    width: 42,
                    height: 24,
                    background: isAvailable ? "#C7255E" : "#E5E7EB",
                  }}
                >
                  <span
                    className="absolute rounded-full bg-white shadow-sm transition-transform duration-200"
                    style={{
                      width: 18,
                      height: 18,
                      top: 3,
                      left: 3,
                      transform: isAvailable ? "translateX(18px)" : "translateX(0)",
                    }}
                  />
                </button>
              </div>

              <div
                className="p-5 rounded-2xl flex items-center justify-between gap-4"
                style={{ background: "#FFF9FB", border: "1px solid #F5D5E2" }}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-xs font-bold"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
                    >
                      Featured Bestseller
                    </span>
                    <StarIcon width={13} height={13} style={{ color: "#C7255E" }} />
                  </div>
                  <span className="text-xs text-gray-500">
                    Spotlight with a gold star badge.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isFeatured}
                  onClick={() => setValue("is_featured", !isFeatured)}
                  className="relative flex-shrink-0 rounded-full transition-colors duration-200 border-none cursor-pointer"
                  style={{
                    width: 42,
                    height: 24,
                    background: isFeatured ? "#C7255E" : "#E5E7EB",
                  }}
                >
                  <span
                    className="absolute rounded-full bg-white shadow-sm transition-transform duration-200"
                    style={{
                      width: 18,
                      height: 18,
                      top: 3,
                      left: 3,
                      transform: isFeatured ? "translateX(18px)" : "translateX(0)",
                    }}
                  />
                </button>
              </div>
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
              <span>Delete Donut</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/products")}
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
              <span>{isPending ? "Saving Donut…" : isEdit ? "Update Donut" : "Save & Publish Donut"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Donut Product?"
        description={`Are you sure you want to permanently delete "${product?.name}"? This action cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteProduct.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
