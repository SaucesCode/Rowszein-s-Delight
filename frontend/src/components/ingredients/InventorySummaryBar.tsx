import { Package, AlertTriangle, CheckCircle2, Coins } from "lucide-react";

interface InventorySummaryBarProps {
  totalCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function InventorySummaryBar({
  totalCount,
  lowStockCount,
  outOfStockCount,
  totalValue,
}: InventorySummaryBarProps) {
  const healthyCount = Math.max(0, totalCount - lowStockCount - outOfStockCount);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {/* ─── 1. Total Ingredients ─── */}
      <div
        className="bg-white p-5 rounded-2xl flex items-center gap-4 transition-all"
        style={{
          border: "1px solid var(--ol-card-border, #F5D5E2)",
          boxShadow: "0 1px 3px rgba(43, 24, 32, 0.04)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#FFE6F0", color: "#C7255E" }}
        >
          <Package size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div>
          <span
            className="block text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "#7E6570", letterSpacing: "0.06em" }}
          >
            Total Ingredients
          </span>
          <span
            className="text-2xl font-extrabold"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
          >
            {totalCount} Types
          </span>
          <span className="block text-[11px] text-gray-400 mt-0.5">
            Baking &amp; packaging supplies
          </span>
        </div>
      </div>

      {/* ─── 2. Low Stock Alerts ─── */}
      <div
        className="bg-white p-5 rounded-2xl flex items-center gap-4 transition-all"
        style={{
          border: lowStockCount > 0 ? "1.5px solid #F5CADB" : "1px solid var(--ol-card-border, #F5D5E2)",
          background: lowStockCount > 0 ? "#FFF9FB" : "#FFFFFF",
          boxShadow: lowStockCount > 0 ? "0 2px 8px rgba(199, 37, 94, 0.06)" : "0 1px 3px rgba(43, 24, 32, 0.04)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: lowStockCount > 0 ? "#FFD6E5" : "#F3F4F6",
            color: lowStockCount > 0 ? "#C7255E" : "#9CA3AF",
          }}
        >
          <AlertTriangle size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div>
          <span
            className="block text-[11px] font-bold uppercase tracking-wider"
            style={{ color: lowStockCount > 0 ? "#C7255E" : "#7E6570", letterSpacing: "0.06em" }}
          >
            Low Stock Alert
          </span>
          <span
            className="text-2xl font-extrabold"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: lowStockCount > 0 ? "#C7255E" : "#2B1820",
            }}
          >
            {lowStockCount} {lowStockCount === 1 ? "Item" : "Items"}
          </span>
          <span className="block text-[11px] mt-0.5" style={{ color: lowStockCount > 0 ? "#C7255E" : "#9CA3AF" }}>
            {lowStockCount > 0 ? "Requires purchase restock" : "All items safely stocked"}
          </span>
        </div>
      </div>

      {/* ─── 3. Healthy Stock ─── */}
      <div
        className="bg-white p-5 rounded-2xl flex items-center gap-4 transition-all"
        style={{
          border: "1px solid var(--ol-card-border, #F5D5E2)",
          boxShadow: "0 1px 3px rgba(43, 24, 32, 0.04)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#E6F7F2", color: "#0F766E" }}
        >
          <CheckCircle2 size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div>
          <span
            className="block text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "#7E6570", letterSpacing: "0.06em" }}
          >
            In Healthy Stock
          </span>
          <span
            className="text-2xl font-extrabold"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
          >
            {healthyCount} {healthyCount === 1 ? "Item" : "Items"}
          </span>
          <span className="block text-[11px] text-gray-400 mt-0.5">
            Adequate production reserve
          </span>
        </div>
      </div>

      {/* ─── 4. Pantry Valuation ─── */}
      <div
        className="bg-white p-5 rounded-2xl flex items-center gap-4 transition-all"
        style={{
          border: "1px solid var(--ol-card-border, #F5D5E2)",
          boxShadow: "0 1px 3px rgba(43, 24, 32, 0.04)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#FFF0F5", color: "#C7255E" }}
        >
          <Coins size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div>
          <span
            className="block text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "#7E6570", letterSpacing: "0.06em" }}
          >
            Pantry Valuation
          </span>
          <span
            className="text-2xl font-extrabold"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C7255E" }}
          >
            {formatPeso(totalValue)}
          </span>
          <span className="block text-[11px] text-gray-400 mt-0.5">
            Raw inventory cost basis
          </span>
        </div>
      </div>
    </div>
  );
}
