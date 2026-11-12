import { useEffect, useState } from "react";
import { X, PackagePlus, PackageMinus } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";
import { stockQuanta, stockText } from "@/lib/stockQuantity";

interface UpdateStockModalProps {
  ingredient: Ingredient | null;
  loading?: boolean;
  onSave: (delta: string, reason: string) => void;
  onCancel: () => void;
}

export default function UpdateStockModal(props: UpdateStockModalProps) {
  if (!props.ingredient) return null;
  return <StockAdjustmentDialog key={props.ingredient.id} {...props} ingredient={props.ingredient} />;
}

function StockAdjustmentDialog({
  ingredient,
  loading = false,
  onSave,
  onCancel,
}: Omit<UpdateStockModalProps, "ingredient"> & { ingredient: Ingredient }) {
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [ingredient, onCancel]);

  const current = String(ingredient.quantity);
  let delta = "0.000000000";
  let resulting = "Invalid quantity";
  let isValid = false;
  try {
    const magnitude = stockQuanta(amount || "0");
    const change = mode === "add" ? magnitude : -magnitude;
    const projected = stockQuanta(current) + change;
    delta = stockText(change);
    stockQuanta(stockText(projected)); // Also reject projected field overflow.
    resulting = stockText(projected);
    isValid = magnitude > 0n && projected >= 0n && note.trim().length > 0;
  } catch { /* Invalid input is not submitted. */ }

  const handleSave = () => {
    if (!isValid) return;
    onSave(delta, note.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(43, 24, 32, 0.4)", backdropFilter: "blur(4px)" }}
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-stock-title"
        className="w-full max-w-md animate-slide-up bg-white rounded-3xl overflow-hidden shadow-2xl"
        style={{
          border: "1px solid var(--ol-card-border, #F5D5E2)",
          boxShadow: "0 20px 45px rgba(199, 37, 94, 0.16)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between p-6"
          style={{ borderBottom: "1px solid #F8EBF1" }}
        >
          <div className="min-w-0">
            <h2
              id="update-stock-title"
              className="text-lg font-extrabold"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#2B1820" }}
            >
              Adjust Pantry Stock
            </h2>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {ingredient.name} — Currently has <strong className="text-[#2B1820]">{Number(current).toLocaleString("en-PH")} {ingredient.unit}</strong>
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer border-none bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"
            aria-label="Close dialog"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Segmented Mode: Add vs Deduct */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-2xl"
            style={{ background: "#FFF0F5" }}
          >
            <button
              type="button"
              onClick={() => setMode("add")}
              className="flex-1 flex items-center justify-center gap-2 font-bold rounded-xl transition-all cursor-pointer border-none py-2.5 text-xs"
              style={{
                background: mode === "add" ? "#FFFFFF" : "transparent",
                color: mode === "add" ? "#0F766E" : "#7E6570",
                boxShadow: mode === "add" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <PackagePlus size={15} strokeWidth={2.5} aria-hidden="true" />
              <span>Add Stock / Shipment</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("deduct")}
              className="flex-1 flex items-center justify-center gap-2 font-bold rounded-xl transition-all cursor-pointer border-none py-2.5 text-xs"
              style={{
                background: mode === "deduct" ? "#FFFFFF" : "transparent",
                color: mode === "deduct" ? "#DC2626" : "#7E6570",
                boxShadow: mode === "deduct" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <PackageMinus size={15} strokeWidth={2.5} aria-hidden="true" />
              <span>Deduct / Usage</span>
            </button>
          </div>

          {/* Quantity Input */}
          <div>
            <label
              htmlFor="stock-amount"
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: "#2B1820" }}
            >
              Quantity ({ingredient.unit}) <span style={{ color: "#C7255E" }}>*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="stock-amount"
                type="number"
                min="0"
                step="0.000000001"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 text-sm rounded-xl outline-none font-bold transition-all"
                style={{
                  background: "#FFFDFE",
                  border: "1px solid #F1D3E0",
                  color: "#2B1820",
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = "#C7255E";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = "#F1D3E0";
                  e.currentTarget.style.boxShadow = "none";
                }}
                autoFocus
              />
              <span className="absolute right-4 text-xs font-bold text-gray-400 uppercase pointer-events-none">
                {ingredient.unit}
              </span>
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label
              htmlFor="stock-note"
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: "#2B1820" }}
            >
              Reason / Note <span style={{ color: "#C7255E" }}>*</span>
            </label>
            <textarea
              id="stock-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder={mode === "add" ? "e.g. Weekly bulk delivery from Manila Flour Mills" : "e.g. Batch #14 brioche donuts & glazes"}
              className="w-full px-4 py-2.5 text-sm rounded-xl outline-none resize-none transition-all"
              style={{ background: "#FFFDFE", border: "1px solid #F1D3E0", color: "#2B1820" }}
              onFocus={e => {
                e.currentTarget.style.borderColor = "#C7255E";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199, 37, 94, 0.12)";
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = "#F1D3E0";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Resulting Stock Projection Card */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: "#FFF7FA", border: "1px solid #FCD4E3" }}
          >
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7E6570" }}>
              Projected Stock
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className="text-lg font-extrabold"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C7255E" }}
              >
                {resulting}
              </span>
              <span className="text-xs font-semibold text-gray-500">{ingredient.unit}</span>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ background: "#FFFDFE", borderTop: "1px solid #F8EBF1" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-full text-xs font-semibold transition-all bg-transparent cursor-pointer border"
            style={{ borderColor: "#F5D5E2", color: "#7E6570" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !isValid}
            className="owner-action-btn-primary cursor-pointer"
            style={{ opacity: loading || !isValid ? 0.6 : 1 }}
          >
            {loading ? "Adjusting Stock…" : "Confirm Stock Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
