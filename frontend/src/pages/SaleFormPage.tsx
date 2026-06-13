import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSale, useCreateSale, useUpdateSale } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { Plus, Trash2 } from "lucide-react";

const saleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  sale_items: z
    .array(
      z.object({
        product: z.coerce.number().min(1, "Product is required"),
        quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
        unit_price: z.coerce.number().min(0.01, "Price must be greater than 0"),
      }),
    )
    .min(1, "At least one item is required"),
});

type SaleForm = z.infer<typeof saleSchema>;

function OrderTotal({ control }: { control: any }) {
  const items = useWatch({ control, name: "sale_items" });
  const total =
    items?.reduce((sum: number, item: any) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0) ?? 0;

  return (
    <div className="flex items-center justify-end gap-2 pt-2 border-t">
      <span className="text-sm font-medium text-slate-700">Total:</span>
      <span className="text-base font-semibold text-slate-800">₱{total.toFixed(2)}</span>
    </div>
  );
}

export default function SaleFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: sale, isLoading: saleLoading } = useSale(Number(id));
  const { data: productsData } = useProducts();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale(Number(id));

  const products = productsData?.data?.results ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      sale_items: [{ product: 0, quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sale_items",
  });

  useEffect(() => {
    if (sale) {
      reset({
        date: sale.date,
        notes: sale.notes ?? "",
        sale_items: sale.sale_items?.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
        })) ?? [{ product: 0, quantity: 1, unit_price: 0 }],
      });
    }
  }, [sale, reset]);

  // Auto-fill unit price when product is selected
  const handleProductChange = (index: number, productId: number) => {
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      setValue(`sale_items.${index}.unit_price`, Number(product.price));
    }
  };

  const onSubmit = (data: SaleForm) => {
    if (isEdit) {
      updateSale.mutate(data);
    } else {
      createSale.mutate(data);
    }
  };

  const isPending = createSale.isPending || updateSale.isPending;

  if (isEdit && saleLoading) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">
          {isEdit ? "Edit Sale" : "Record Sale"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEdit ? "Update sale details" : "Record a new sales transaction"}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Sale Info */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              {...register("date")}
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              placeholder="e.g. Morning sales, walk-in customers..."
            />
          </div>
        </div>

        {/* Sale Items */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Items</h2>
            <button
              type="button"
              onClick={() => append({ product: 0, quantity: 1, unit_price: 0 })}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>

          {errors.sale_items?.root && (
            <p className="text-xs text-red-500 mb-3">{errors.sale_items.root.message}</p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-3">
                {/* Product */}
                <div className="flex-1">
                  <select
                    {...register(`sale_items.${index}.product`)}
                    onChange={e => {
                      register(`sale_items.${index}.product`).onChange(e);
                      handleProductChange(index, Number(e.target.value));
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value={0}>Select product</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.sale_items?.[index]?.product && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.sale_items[index]?.product?.message}
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div className="w-24">
                  <input
                    {...register(`sale_items.${index}.quantity`)}
                    type="number"
                    min="1"
                    placeholder="Qty"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  {errors.sale_items?.[index]?.quantity && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.sale_items[index]?.quantity?.message}
                    </p>
                  )}
                </div>

                {/* Unit Price */}
                <div className="w-28">
                  <input
                    {...register(`sale_items.${index}.unit_price`)}
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  {errors.sale_items?.[index]?.unit_price && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.sale_items[index]?.unit_price?.message}
                    </p>
                  )}
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="mt-2 text-slate-400 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <OrderTotal control={control} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEdit ? "Update Sale" : "Record Sale"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/sales")}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
