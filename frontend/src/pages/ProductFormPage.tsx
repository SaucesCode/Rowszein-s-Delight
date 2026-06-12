import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProduct, useCreateProduct, useUpdateProduct } from "@/hooks/useProducts";
import { ImageOff } from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0.01, "Price must be greater than 0"),
  is_available: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

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
      if (product.image_url) {
        setImagePreview(product.image_url);
      }
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
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">
          {isEdit ? "Edit Product" : "Add Product"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEdit ? "Update product details" : "Add a new product to your menu"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border p-6 space-y-4"
      >
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Image <span className="text-slate-400">(optional)</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageOff size={20} className="text-slate-400" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border file:text-sm file:text-slate-600 file:bg-white hover:file:bg-slate-50"
            />
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            {...register("name")}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="e.g. Chocolate Donut"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            placeholder="Describe the product..."
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Price (₱)</label>
          <input
            {...register("price")}
            type="number"
            step="0.01"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="0.00"
          />
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
        </div>

        {/* Availability */}
        <div className="flex items-center gap-3">
          <input
            {...register("is_available")}
            type="checkbox"
            id="is_available"
            className="w-4 h-4 rounded border-slate-300"
          />
          <label htmlFor="is_available" className="text-sm font-medium text-slate-700">
            Available for sale
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEdit ? "Update Product" : "Add Product"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
