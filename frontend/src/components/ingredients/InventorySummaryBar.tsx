function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface InventorySummaryBarProps {
  totalCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

export default function InventorySummaryBar({
  totalCount,
  lowStockCount,
  outOfStockCount,
  totalValue,
}: InventorySummaryBarProps) {
  const items: {
    label: string;
    value: string | number;
    tone?: "warning" | "danger";
  }[] = [
    { label: "Total Ingredients", value: totalCount },
    {
      label: "Low Stock",
      value: lowStockCount,
      tone: lowStockCount > 0 ? "warning" : undefined,
    },
    {
      label: "Out of Stock",
      value: outOfStockCount,
      tone: outOfStockCount > 0 ? "danger" : undefined,
    },
    { label: "Inventory Value", value: formatPeso(totalValue) },
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
              color:
                item.tone === "warning"
                  ? "#946200"
                  : item.tone === "danger"
                    ? "#B91C1C"
                    : "#6B4226",
            }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
