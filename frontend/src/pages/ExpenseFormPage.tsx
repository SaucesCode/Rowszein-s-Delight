import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExpense, useCreateExpense, useUpdateExpense } from "@/hooks/useExpenses";
import type { ExpenseCategory } from "@/types/expense.types";

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "ingredient", label: "Ingredient Purchase" },
  { value: "packaging", label: "Packaging" },
  { value: "utilities", label: "Utilities" },
  { value: "transportation", label: "Transportation" },
  { value: "other", label: "Other" },
];

const expenseSchema = z.object({
  category: z.enum(["ingredient", "packaging", "utilities", "transportation", "other"]),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

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
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "other",
      date: new Date().toISOString().split("T")[0],
    },
  });

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
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">
          {isEdit ? "Edit Expense" : "Record Expense"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEdit ? "Update expense details" : "Record a new business expense"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            {...register("category")}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₱)</label>
          <input
            {...register("amount")}
            type="number"
            step="0.01"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="0.00"
          />
          {errors.amount && (
            <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
          )}
        </div>

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
            Description <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            placeholder="What was this expense for?"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEdit ? "Update Expense" : "Record Expense"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/expenses")}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
