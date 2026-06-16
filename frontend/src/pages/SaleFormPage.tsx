import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSale, useCreateSale, useUpdateSale } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { Plus, Trash2 } from "lucide-react";
import SkeletonTable from "@/components/SkeletonTable";

/* ─────────────────────────────────────────────
   SCHEMA
   ───────────────────────────────────────────── */
const saleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  sale_items: z
    .array(
      z.object({
        product: z.coerce.number().min(1, "Product is required"),
        quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
        unit_price: z.coerce.number().min(0.01, "Price must be greater than ₱0"),
      }),
    )
    .min(1, "At least one item is required"),
});

type SaleForm = z.infer<typeof saleSchema>;

/* ─────────────────────────────────────────────
   FIELD — labeled input block
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
   ORDER TOTAL — live computed total
   ───────────────────────────────────────────── */
function OrderTotal({ control }: { control: any }) {
  const items = useWatch({ control, name: "sale_items" });
  const total =
    items?.reduce((sum: number, item: any) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0) ?? 0;

  return (
    <div
      className="flex items-center justify-end gap-3 pt-3 mt-3"
      style={{ borderTop: "1px solid #F5EDE0" }}
    >
      <span className="font-body" style={{ fontSize: 13, color: "#9B6644" }}>
        Order Total
      </span>
      <span className="font-heading font-semibold" style={{ fontSize: 18, color: "#6B4226" }}>
        ₱{total.toFixed(2)}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
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

  const { fields, append, remove } = useFieldArray({ control, name: "sale_items" });

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

  /* Auto-fill unit price when product is selected */
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
    return <SkeletonTable rows={4} cols={2} showHeader />;
  }

  return (
    <div className="max-w-400">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* ── Sale info ── */}
        <div className="card-surface p-6 space-y-5">
          <Field
            label="Sale Date"
            helper="When did this sale take place?"
            error={errors.date?.message}
            required
          >
            <input
              {...register("date")}
              type="date"
              className="field-input mt-1"
              aria-invalid={!!errors.date}
            />
          </Field>

          <Field
            label="Notes"
            helper="Optional — e.g. Morning batch, walk-in customers, event order"
          >
            <textarea
              {...register("notes")}
              rows={2}
              className="field-input mt-1"
              style={{ resize: "none" }}
              placeholder="Any notes about this sale…"
            />
          </Field>
        </div>

        {/* ── Sale items ── */}
        <div className="card-surface p-6">
          {/* Section header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p
                className="font-heading font-semibold"
                style={{ fontSize: 14, color: "#6B4226" }}
              >
                Items Sold
              </p>
              <p className="field-helper" style={{ marginTop: 2 }}>
                Add each product sold in this transaction
              </p>
            </div>
            <button
              type="button"
              onClick={() => append({ product: 0, quantity: 1, unit_price: 0 })}
              className="btn-ghost"
              style={{ fontSize: 12, padding: "5px 12px" }}
            >
              <Plus size={13} aria-hidden="true" />
              Add Item
            </button>
          </div>

          {/* List-level error */}
          {errors.sale_items?.root && (
            <p className="field-error mb-3" role="alert">
              {errors.sale_items.root.message}
            </p>
          )}

          {/* Column labels */}
          <div
            className="grid gap-3 mb-2 px-1"
            style={{ gridTemplateColumns: "1fr 80px 110px 32px" }}
          >
            {["Product", "Qty", "Unit Price (₱)", ""].map(label => (
              <p
                key={label}
                className="font-heading"
                style={{
                  fontSize: 11,
                  color: "#9B6644",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {label}
              </p>
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-2.5">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid items-start gap-3"
                style={{ gridTemplateColumns: "1fr 80px 110px 32px" }}
              >
                {/* Product */}
                <div>
                  <select
                    {...register(`sale_items.${index}.product`)}
                    onChange={e => {
                      register(`sale_items.${index}.product`).onChange(e);
                      handleProductChange(index, Number(e.target.value));
                    }}
                    className="field-input"
                    aria-label={`Product for item ${index + 1}`}
                    aria-invalid={!!errors.sale_items?.[index]?.product}
                  >
                    <option value={0}>Select product…</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.sale_items?.[index]?.product && (
                    <p className="field-error mt-1" role="alert">
                      {errors.sale_items[index]?.product?.message}
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <input
                    {...register(`sale_items.${index}.quantity`)}
                    type="number"
                    min="1"
                    placeholder="1"
                    className="field-input"
                    aria-label={`Quantity for item ${index + 1}`}
                    aria-invalid={!!errors.sale_items?.[index]?.quantity}
                  />
                  {errors.sale_items?.[index]?.quantity && (
                    <p className="field-error mt-1" role="alert">
                      {errors.sale_items[index]?.quantity?.message}
                    </p>
                  )}
                </div>

                {/* Unit price */}
                <div>
                  <input
                    {...register(`sale_items.${index}.unit_price`)}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="field-input"
                    aria-label={`Unit price for item ${index + 1}`}
                    aria-invalid={!!errors.sale_items?.[index]?.unit_price}
                  />
                  {errors.sale_items?.[index]?.unit_price && (
                    <p className="field-error mt-1" role="alert">
                      {errors.sale_items[index]?.unit_price?.message}
                    </p>
                  )}
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="flex items-center justify-center rounded-lg transition-colors"
                  style={{
                    width: 32,
                    height: 38,
                    color: fields.length === 1 ? "#D1CEC7" : "#A8A49B",
                    cursor: fields.length === 1 ? "not-allowed" : "pointer",
                  }}
                  onMouseOver={e => {
                    if (fields.length > 1) {
                      (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                      (e.currentTarget as HTMLElement).style.color = "#EF4444";
                    }
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      fields.length === 1 ? "#D1CEC7" : "#A8A49B";
                  }}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {/* Order total */}
          <OrderTotal control={control} />
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Saving…" : isEdit ? "Update Sale" : "Record Sale"}
          </button>
          <button type="button" onClick={() => navigate("/sales")} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
