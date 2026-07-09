import { useEffect, useState } from "react";
import { X, PackagePlus, PackageMinus } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";

interface UpdateStockModalProps {
  ingredient: Ingredient | null;
  loading?: boolean;
  onSave: (resultingQuantity: number) => void;
  onCancel: () => void;
}

export default function UpdateStockModal({
  ingredient,
  loading = false,
  onSave,
  onCancel,
}: UpdateStockModalProps) {
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Reset the form fresh every time a different ingredient is targeted
  useEffect(() => {
    if (ingredient) {
      setMode("add");
      setAmount("");
      setNote("");
    }
  }, [ingredient]);

  useEffect(() => {
    if (!ingredient) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [ingredient, onCancel]);

  if (!ingredient) return null;

  const current = Number(ingredient.quantity);
  const delta = Number(amount) || 0;
  const resulting = mode === "add" ? current + delta : Math.max(0, current - delta);
  const isValid = delta > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave(resulting);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(107, 66, 38, 0.25)", backdropFilter: "blur(2px)" }}
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-stock-title"
        className="w-full max-w-sm animate-slide-up"
        style={{
          background: "#FFFDFB",
          border: "1px solid #E8E6E1",
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(107, 66, 38, 0.18)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between p-5"
          style={{ borderBottom: "1px solid #F5EDE0" }}
        >
          <div className="min-w-0">
            <h2
              id="update-stock-title"
              className="font-heading font-semibold"
              style={{ fontSize: 15, color: "#6B4226" }}
            >
              Update Stock
            </h2>
            <p className="font-body mt-1 truncate" style={{ fontSize: 13, color: "#9B6644" }}>
              {ingredient.name} — currently {current.toLocaleString("en-PH")} {ingredient.unit}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 rounded-lg p-1 ml-2 transition-colors"
            style={{ color: "#A8A49B" }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.background = "#F5EDE0";
              (e.currentTarget as HTMLElement).style.color = "#6B4226";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "#A8A49B";
            }}
            aria-label="Close dialog"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div
            className="flex items-center gap-1 p-1 rounded-lg"
            style={{ background: "#FFF8F0" }}
          >
            <button
              type="button"
              onClick={() => setMode("add")}
              className="flex-1 flex items-center justify-center gap-1.5 font-body font-semibold rounded-md transition-colors"
              style={{
                padding: "8px 10px",
                fontSize: 13,
                background: mode === "add" ? "#FFFFFF" : "transparent",
                color: mode === "add" ? "#3F6B1F" : "#7C5A3D",
                boxShadow: mode === "add" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <PackagePlus size={14} aria-hidden="true" />
              Add Stock
            </button>
            <button
              type="button"
              onClick={() => setMode("deduct")}
              className="flex-1 flex items-center justify-center gap-1.5 font-body font-semibold rounded-md transition-colors"
              style={{
                padding: "8px 10px",
                fontSize: 13,
                background: mode === "deduct" ? "#FFFFFF" : "transparent",
                color: mode === "deduct" ? "#B91C1C" : "#7C5A3D",
                boxShadow: mode === "deduct" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <PackageMinus size={14} aria-hidden="true" />
              Deduct Stock
            </button>
          </div>

          <div>
            <label className="field-label">Quantity ({ingredient.unit})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="field-input mt-1"
              autoFocus
            />
          </div>

          <div>
            <label className="field-label">
              Note{" "}
              <span className="font-body" style={{ color: "#A8A49B", fontWeight: 400 }}>
                (optional)
              </span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Restocked from SM Supermarket"
              className="field-input mt-1"
              style={{ resize: "none" }}
            />
          </div>

          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: "#FFF8F0" }}
          >
            <span className="font-body" style={{ fontSize: 13, color: "#9B6644" }}>
              Resulting stock
            </span>
            <span
              className="font-heading font-semibold"
              style={{ fontSize: 16, color: "#6B4226" }}
            >
              {resulting.toLocaleString("en-PH")} {ingredient.unit}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid #F5EDE0" }}
        >
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost"
            style={{ fontSize: 13, padding: "7px 16px" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !isValid}
            className="btn-primary"
            style={{ fontSize: 13, padding: "7px 16px" }}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
