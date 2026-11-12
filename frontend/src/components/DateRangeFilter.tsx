import { X } from "lucide-react";
import { useId } from "react";

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
  hasFilters: boolean;
  error?: string;
}

export default function DateRangeFilter({
  dateFrom, dateTo, onDateFromChange, onDateToChange, onClear, hasFilters, error,
}: DateRangeFilterProps) {
  const id = useId();
  const description = error ? `${id}-error` : undefined;
  return (
    <fieldset className="workspace-date-fields">
      <legend className="sr-only">Custom date range</legend>
      <div className="workspace-date-controls">
        <div>
          <label htmlFor={`${id}-from`} className="field-label">From</label>
          <input
            type="date"
            id={`${id}-from`}
            aria-describedby={description}
            value={dateFrom}
            onChange={event => onDateFromChange(event.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="field-label">To</label>
          <input
            type="date"
            id={`${id}-to`}
            aria-describedby={description}
            aria-invalid={error ? true : undefined}
            value={dateTo}
            onChange={event => onDateToChange(event.target.value)}
            className="field-input"
          />
        </div>
        {hasFilters && (
          <button type="button" onClick={onClear} className="btn-ghost">
            <X size={15} aria-hidden="true" /> Clear
          </button>
        )}
      </div>
      {error && <p id={description} className="field-error mt-3" role="alert">{error}</p>}
    </fieldset>
  );
}
