import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExpense, useCreateExpense, useUpdateExpense } from "@/hooks/useExpenses";
import type { ExpenseCategory } from "@/types/expense.types";
import SkeletonTable from "@/components/SkeletonTable";

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */
const CATEGORIES: { value: ExpenseCategory; label: string; helper: string }[] = [
  {
    value: "ingredient",
    label: "Ingredient Purchase",
    helper: "Raw materials bought for production",
  },
  {
    value: "packaging",
    label: "Packaging",
    helper: "Boxes, bags, labels, wrapping materials",
  },
  {
    value: "utilities",
    label: "Utilities",
    helper: "Electricity, water, gas, internet",
  },
  {
    value: "transportation",
    label: "Transportation",
    helper: "Delivery, fuel, commute for business purposes",
  },
  {
    value: "other",
    label: "Other",
    helper: "Any other business-related expense",
  },
];

/* ─────────────────────────────────────────────
   SCHEMA
   ───────────────────────────────────────────── */
const expenseSchema = z.object({
  category: z.enum(["ingredient", "packaging", "utilities", "transportation", "other"]),
  amount: z.coerce.number().min(0.01, "Amount must be greater than ₱0"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

/* ─────────────────────────────────────────────
   FIELD — reusable labeled block
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
   CATEGORY SELECTOR — visual card grid
   ───────────────────────────────────────────── */
function CategorySelector({
  value,
  onChange,
  error,
}: {
  value: ExpenseCategory;
  onChange: (val: ExpenseCategory) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="field-label">
        Category
        <span style={{ color: "#FF6FAE", marginLeft: 3 }} aria-hidden="true">
          *
        </span>
      </label>

      <div
        className="grid gap-2 mt-1"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        role="group"
        aria-label="Expense category"
      >
        {CATEGORIES.map(cat => {
          const isSelected = value === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => onChange(cat.value)}
              className="text-left transition-all"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: isSelected ? "2px solid #FF6FAE" : "1.5px solid #E8E6E1",
                background: isSelected ? "#FFF0F7" : "#FFFDFB",
                cursor: "pointer",
                outline: "none",
              }}
              aria-pressed={isSelected}
            >
              <p
                className="font-heading font-semibold"
                style={{
                  fontSize: 12,
                  color: isSelected ? "#E5528A" : "#6B4226",
                  lineHeight: 1.3,
                }}
              >
                {cat.label}
              </p>
              <p
                className="font-body mt-0.5"
                style={{
                  fontSize: 11,
                  color: isSelected ? "#9B6644" : "#A8A49B",
                  lineHeight: 1.4,
                }}
              >
                {cat.helper}
              </p>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="field-error mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function ExpenseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: expense, isLoading } = useExpense(Number(id));
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense(Number(id));

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "other",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const selectedCategory = watch("category");

  useEffect(() => {
    if (expense) {
      reset({
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
      });
    }
  }, [expense, reset]);

  const onSubmit = (data: ExpenseForm) => {
    if (isEdit) {
      updateExpense.mutate(data);
    } else {
      createExpense.mutate(data);
    }
  };

  const isPending = createExpense.isPending || updateExpense.isPending;

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
        {/* Category */}
        <CategorySelector
          value={selectedCategory}
          onChange={val => setValue("category", val)}
          error={errors.category?.message}
        />

        {/* Divider */}
        <div style={{ borderTop: "1px solid #F5EDE0" }} />

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Amount (₱)"
            helper="Total cost of this expense"
            error={errors.amount?.message}
            required
          >
            <input
              {...register("amount")}
              type="number"
              step="0.01"
              min="0"
              className="field-input mt-1"
              placeholder="0.00"
              autoFocus={!isEdit}
              aria-invalid={!!errors.amount}
            />
          </Field>

          <Field
            label="Date"
            helper="When did this expense occur?"
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
        </div>

        {/* Description */}
        <Field
          label="Description"
          helper="Optional — briefly describe what this expense was for"
          error={errors.description?.message}
        >
          <textarea
            {...register("description")}
            rows={3}
            className="field-input mt-1"
            style={{ resize: "none" }}
            placeholder="e.g. Bought 10kg all-purpose flour from SM, paid electric bill for June…"
          />
        </Field>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #F5EDE0" }} />

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Saving…" : isEdit ? "Update Expense" : "Record Expense"}
          </button>
          <button type="button" onClick={() => navigate("/expenses")} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
