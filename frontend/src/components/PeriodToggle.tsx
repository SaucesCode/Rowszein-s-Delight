interface PeriodToggleOption {
  value: string;
  label: string;
}

interface PeriodToggleProps {
  options: PeriodToggleOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export default function PeriodToggle({ options, value, onChange, ariaLabel }: PeriodToggleProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg p-1 overflow-x-auto"
      style={{ background: "#FFF8F0", border: "1px solid #F0E6D8" }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className="font-body font-medium whitespace-nowrap rounded-md transition-colors duration-150"
            style={{
              padding: "7px 14px",
              fontSize: 13,
              background: isActive ? "#FF6FAE" : "transparent",
              color: isActive ? "#FFFFFF" : "#7C5A3D",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}