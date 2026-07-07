interface CategoryFilterBarProps {
  options: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
  counts?: Record<string, number>;
  ariaLabel: string;
}

export default function CategoryFilterBar({
  options,
  active,
  onChange,
  counts,
  ariaLabel,
}: CategoryFilterBarProps) {
  const allOptions = [{ value: "all", label: "All" }, ...options];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {allOptions.map(option => {
        const isActive = active === option.value;
        const count = counts?.[option.value];

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className="inline-flex items-center gap-1.5 font-body font-medium rounded-full transition-colors duration-150"
            style={{
              fontSize: 12.5,
              padding: "6px 12px",
              background: isActive ? "#FF6FAE" : "#FFFDFB",
              color: isActive ? "#FFFFFF" : "#7C5A3D",
              border: isActive ? "none" : "1px solid #E8E6E1",
            }}
          >
            {option.label}
            {count !== undefined && (
              <span
                className="font-body"
                style={{
                  fontSize: 10.5,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isActive ? "rgba(255,255,255,0.25)" : "#F1EFE8",
                  color: isActive ? "#FFFFFF" : "#9B8C74",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
