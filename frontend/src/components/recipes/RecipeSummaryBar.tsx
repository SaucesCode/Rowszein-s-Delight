function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface RecipeSummaryBarProps {
  totalRecipes: number;
  missingCount: number;
  avgProductionCost: number;
  avgCostPerUnit: number;
}

/**
 * Same 4-column strip shell as InventorySummaryBar (Ingredients page) —
 * kept visually identical on purpose so the owner recognizes the pattern
 * immediately instead of learning a new layout per page.
 */
export default function RecipeSummaryBar({
  totalRecipes,
  missingCount,
  avgProductionCost,
  avgCostPerUnit,
}: RecipeSummaryBarProps) {
  const items: {
    label: string;
    value: string | number;
    tone?: "warning";
  }[] = [
    { label: "Total Recipes", value: totalRecipes },
    {
      label: "Missing Recipes",
      value: missingCount,
      tone: missingCount > 0 ? "warning" : undefined,
    },
    { label: "Avg. Batch Cost", value: formatPeso(avgProductionCost) },
    { label: "Avg. Cost / Unit", value: formatPeso(avgCostPerUnit) },
  ];

  return (
    <div
      className="flex flex-wrap mb-6 overflow-hidden"
      style={{ background: "#FFFDFB", border: "1px solid #E8E6E1", borderRadius: 10 }}
    >
      {items.map((item, idx) => (
        <div
          key={item.label}
          className="flex-1 min-w-[150px] px-5 py-4"
          style={{ borderLeft: idx > 0 ? "1px solid #F5EDE0" : undefined }}
        >
          <p
            className="font-body"
            style={{
              fontSize: 11,
              color: "#9B6644",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 600,
            }}
          >
            {item.label}
          </p>
          <p
            className="font-heading font-semibold mt-1"
            style={{
              fontSize: 20,
              lineHeight: 1.2,
              color: item.tone === "warning" ? "#946200" : "#6B4226",
            }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
