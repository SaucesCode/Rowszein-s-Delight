import { Minus, PackageMinus, PackagePlus, Plus } from "lucide-react";
import { formatAmount, unitLabel, unitStep } from "@/lib/stockStatus";
import { REASONS, stepped, type StockUpdate } from "./useStockUpdate";

export function StockForm({ state }: { state: StockUpdate }) {
  const { ingredient, formId, direction, amount, reason, showErrors, result, reasonError } = state;
  const unit = unitLabel(ingredient.unit);
  const step = unitStep(ingredient.unit);

  return (
    <form id={formId} className="stock-form" onSubmit={state.submit} noValidate aria-labelledby={`${formId}-title`}>
      <h3 id={`${formId}-title`} className="stock-form-title">Update stock</h3>

      <div className="stock-direction" role="group" aria-label="What happened?">
        <button type="button" aria-pressed={direction === "in"} onClick={() => state.switchDirection("in")}>
          <PackagePlus size={18} aria-hidden="true" />
          Delivery came in
        </button>
        <button type="button" aria-pressed={direction === "out"} onClick={() => state.switchDirection("out")}>
          <PackageMinus size={18} aria-hidden="true" />
          Used or spoiled
        </button>
      </div>

      <div>
        <label htmlFor={`${formId}-amount`} className="field-label">
          How much {direction === "in" ? "came in" : "was used"}?
        </label>
        <div className="stock-stepper">
          <button
            type="button"
            className="stock-step"
            onClick={() => state.setAmount(value => stepped(value, -step))}
            aria-label={`Less, by ${step} ${unit}`}
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <div className="stock-amount">
            <input
              id={`${formId}-amount`}
              className="num"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={event => state.setAmount(event.target.value)}
              aria-invalid={showErrors && !!result.amountError}
              aria-describedby={showErrors && result.amountError ? `${formId}-amount-error` : undefined}
            />
            <span aria-hidden="true">{unit}</span>
          </div>
          <button
            type="button"
            className="stock-step"
            onClick={() => state.setAmount(value => stepped(value, step))}
            aria-label={`More, by ${step} ${unit}`}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        {showErrors && result.amountError && (
          <p id={`${formId}-amount-error`} className="field-error">{result.amountError}</p>
        )}
      </div>

      <fieldset className="stock-reason">
        <legend className="field-label">Reason</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS[direction].map(option => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={reason === option}
              onClick={() => state.setReason(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <label htmlFor={`${formId}-reason`} className="sr-only">Reason, in your own words</label>
        <input
          id={`${formId}-reason`}
          className="field-input mt-3"
          placeholder="Or type your own"
          value={reason}
          maxLength={200}
          onChange={event => state.setReason(event.target.value)}
          aria-invalid={showErrors && !!reasonError}
          aria-describedby={showErrors && reasonError ? `${formId}-reason-error` : undefined}
        />
        {showErrors && reasonError && <p id={`${formId}-reason-error`} className="field-error">{reasonError}</p>}
      </fieldset>
    </form>
  );
}

export function StockFoot({ state }: { state: StockUpdate }) {
  const { ingredient, result, amount, direction, saving } = state;
  const current = String(ingredient.quantity);
  const minimum = Number(ingredient.minimum_stock);
  const note =
    result.total === null || minimum <= 0
      ? null
      : Number(result.total) <= minimum
        ? "Still at or below the restock level."
        : Number(current) <= minimum
          ? "Back above the restock level."
          : null;

  return (
    <footer className="stock-form-foot">
      <p className="stock-total" aria-live="polite">
        <span>{result.total === null ? "In stock now" : "New total"}</span>
        <strong className="num">{formatAmount(result.total ?? current, ingredient.unit)}</strong>
        {note && <em>{note}</em>}
      </p>
      <button type="submit" form={state.formId} className="btn-primary" disabled={saving} aria-busy={saving}>
        {saving
          ? "Saving…"
          : result.amountError
            ? "Save"
            : `${direction === "in" ? "Add" : "Take out"} ${formatAmount(amount, ingredient.unit)}`}
      </button>
    </footer>
  );
}
