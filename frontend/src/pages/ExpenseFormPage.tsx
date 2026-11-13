import { useId, useState } from "react";
import { useBlocker, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useCreateExpense, useDeleteExpense, useExpense, useUpdateExpense } from "@/hooks/useExpenses";
import { manilaDate } from "@/lib/dateRanges";
import { validRecordId } from "@/lib/managementQueryKeys";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import type { Expense, ExpenseCategory } from "@/types/expense.types";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import Row from "@/components/ui/SettingsRow";
import { formatPeso } from "@/pages/dashboard/report-format";
import "./expenses/expenses.css";

const CATEGORY_VALUES = ["ingredient", "packaging", "utilities", "transportation", "other"] as const;

const expenseSchema = z.object({
  category: z.enum(CATEGORY_VALUES, { error: "Choose what it was for" }),
  amount: z.coerce.number({ error: "Enter how much you paid" }).min(0.01, "Enter how much you paid, more than ₱0"),
  description: z.string().optional(),
  date: z.string().min(1, "Choose the date you paid"),
});

type FormInput = z.input<typeof expenseSchema>;
type FormOutput = z.output<typeof expenseSchema>;

const isCategory = (value: string | null): value is ExpenseCategory =>
  !!value && (CATEGORY_VALUES as readonly string[]).includes(value);

function ExpenseForm({ expense, presetCategory }: { expense?: Expense; presetCategory?: ExpenseCategory }) {
  const navigate = useNavigate();
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const today = manilaDate();
  const isEdit = !!expense;

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense(expense?.id ?? 0);
  const deleteExpense = useDeleteExpense();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? { category: expense.category, amount: expense.amount, description: expense.description, date: expense.date }
      : { category: presetCategory, amount: "", description: "", date: today },
  });

  const isSaving = createExpense.isPending || updateExpense.isPending;
  const isDone = createExpense.isSuccess || updateExpense.isSuccess || deleteExpense.isPending || deleteExpense.isSuccess;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && !isSaving && !isDone && currentLocation.pathname !== nextLocation.pathname,
  );

  const onSubmit = (data: FormOutput) => {
    const payload = { ...data, description: data.description?.trim() };
    if (expense) updateExpense.mutate(payload);
    else createExpense.mutate(payload);
  };

  return (
    <>
      <form className="settings-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <header className="page-head">
          <div>
            <h1 className="type-page">{isEdit ? "Edit expense" : "Log an expense"}</h1>
            <p className="page-lede">
              {isEdit
                ? `Logged as ${formatPeso(Number(expense.amount))}. Changes update your profit straight away.`
                : "Anything the shop paid for. It comes off your profit for that day."}
            </p>
          </div>
        </header>

        <section className="settings-group" aria-labelledby={field("what")}>
          <h2 id={field("what")} className="settings-group-title">What was it for?</h2>
          <div className="settings-card settings-card-padded">
            <fieldset className="category-tiles" aria-describedby={errors.category ? field("category-msg") : undefined}>
              <legend className="sr-only">Kind of expense</legend>
              {EXPENSE_CATEGORIES.map(info => {
                const Icon = info.icon;
                return (
                  <label key={info.value} className="category-tile">
                    <input type="radio" value={info.value} className="sr-only" {...register("category")} />
                    <span className="quick-log-icon" style={{ background: info.color }} aria-hidden="true">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="category-tile-text">
                      <strong>{info.label}</strong>
                      <span>{info.hint}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {errors.category && <p id={field("category-msg")} className="field-error">{errors.category.message}</p>}
          </div>
        </section>

        <section className="settings-group" aria-labelledby={field("details")}>
          <h2 id={field("details")} className="settings-group-title">Details</h2>
          <div className="settings-card">
            <Row label="Amount paid" htmlFor={field("amount")} error={errors.amount?.message}>
              <div className="settings-unit-input is-prefix expense-amount">
                <span aria-hidden="true">₱</span>
                <input
                  id={field("amount")}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  className="field-input num"
                  autoFocus={!isEdit && !!presetCategory}
                  aria-invalid={!!errors.amount}
                  aria-describedby={errors.amount ? `${field("amount")}-msg` : undefined}
                  {...register("amount")}
                />
              </div>
            </Row>
            <Row label="Date paid" htmlFor={field("date")} error={errors.date?.message}>
              <input
                id={field("date")}
                type="date"
                className="field-input settings-date"
                max={today}
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? `${field("date")}-msg` : undefined}
                {...register("date")}
              />
            </Row>
            <Row label="What exactly" htmlFor={field("description")} hint="Optional, but it helps later. For example, “10 kg flour from SM”.">
              <textarea
                id={field("description")}
                className="field-input"
                rows={2}
                maxLength={500}
                aria-describedby={`${field("description")}-msg`}
                {...register("description")}
              />
            </Row>
          </div>
        </section>

        {expense && (
          <section className="settings-group" aria-label="Delete">
            <div className="settings-card">
              <button type="button" className="settings-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={18} aria-hidden="true" />
                Delete expense
              </button>
            </div>
          </section>
        )}

        <footer className="settings-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate("/expenses")}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSaving} aria-busy={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Log expense"}
          </button>
        </footer>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        title={expense ? `Delete this ${formatPeso(Number(expense.amount))} expense?` : "Delete this expense?"}
        description="It will be removed from your expenses and your profit will go back up by the same amount. This can't be undone."
        confirmLabel="Delete expense"
        cancelLabel="Keep it"
        destructive
        loading={deleteExpense.isPending}
        onConfirm={() => expense && deleteExpense.mutate(expense.id, { onSuccess: () => navigate("/expenses") })}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description="This expense hasn't been saved yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}

export default function ExpenseFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined;
  const recordId = Number(id);
  const query = useExpense(isEdit && validRecordId(recordId) ? recordId : 0);
  const back = () => navigate("/expenses");

  if (!isEdit) {
    const preset = params.get("category");
    return <ExpenseForm key={preset ?? "new"} presetCategory={isCategory(preset) ? preset : undefined} />;
  }
  if (!validRecordId(recordId)) return <RecordLoadError name="expense" invalidId error={undefined} retry={() => {}} back={back} />;
  if (query.isPending) {
    return (
      <div className="settings-form" aria-busy="true">
        <span className="skeleton block h-10 w-64" />
        <span className="skeleton mt-8 block h-48 w-full" aria-hidden="true" />
        <span className="sr-only" role="status">Loading the expense</span>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <RecordLoadError name="expense" invalidId={false} error={query.error} retry={() => void query.refetch()} back={back} />;
  }
  return <ExpenseForm key={query.data.id} expense={query.data} />;
}
