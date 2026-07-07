import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
}

export default function SearchInput({ value, onChange, placeholder, ariaLabel }: SearchInputProps) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <label className="sr-only" htmlFor="search-input-field">
        {ariaLabel}
      </label>
      <Search
        size={16}
        strokeWidth={2}
        style={{ color: "#B8A98D" }}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="search-input-field"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="field-input w-full"
        style={{ paddingLeft: 36, paddingRight: value ? 36 : 12 }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors"
          style={{ color: "#B8A98D" }}
          aria-label="Clear search"
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}