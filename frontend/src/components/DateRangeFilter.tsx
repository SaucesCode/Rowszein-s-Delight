import { X, Calendar } from "lucide-react";

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
  hasFilters: boolean;
}

export default function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
  hasFilters,
}: DateRangeFilterProps) {
  return (
    <div
      className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg"
      style={{
        background: "#f5f6f8",
        border: "1px solid #e2e8f0",
      }}
    >
      <div className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
        <Calendar size={16} strokeWidth={2} aria-hidden="true" />
        <span className="font-body font-medium">Filter by date:</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
        {/* From date */}
        <div className="flex items-center gap-2">
          <label className="font-body text-xs font-semibold" style={{ color: "#64748b" }}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="field-input"
            style={{
              fontSize: 13,
              padding: "0.5rem 0.75rem",
              width: "auto",
              minWidth: 140,
            }}
          />
        </div>

        {/* To date */}
        <div className="flex items-center gap-2">
          <label className="font-body text-xs font-semibold" style={{ color: "#64748b" }}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="field-input"
            style={{
              fontSize: 13,
              padding: "0.5rem 0.75rem",
              width: "auto",
              minWidth: 140,
            }}
          />
        </div>

        {/* Clear button */}
        {hasFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-body text-xs font-semibold transition-all"
            style={{
              color: "#64748b",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#fee2e2";
              (e.currentTarget as HTMLElement).style.color = "#ef4444";
              (e.currentTarget as HTMLElement).style.borderColor = "#fecaca";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#ffffff";
              (e.currentTarget as HTMLElement).style.color = "#64748b";
              (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
            }}
          >
            <X size={14} strokeWidth={2.5} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
