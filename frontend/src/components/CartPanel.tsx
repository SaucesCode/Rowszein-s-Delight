import { useRef, useState } from "react";
import { X, Plus, Minus, Trash2, Download, ShoppingBag, Trash } from "lucide-react";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import type { CartItem } from "@/hooks/useCart";

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function downloadNode(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, {
    backgroundColor: "#FFF8F0",
    pixelRatio: 2,
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Generates a reference code like "RD-20260622-4F8K".
 * This is purely a client-side display convenience — there is no backend
 * order system, so this code is NOT persisted or tracked anywhere. It
 * exists only to make the saved receipt image feel like a real order
 * confirmation the customer can quote when reaching out to the shop.
 */
function generateReferenceCode(): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `RD-${datePart}-${randomPart}`;
}

/* ─────────────────────────────────────────────
   RECEIPT — hidden, export-only render target
   ───────────────────────────────────────────── */
function ReceiptTemplate({
  items,
  total,
  customerName,
  referenceCode,
  timestamp,
}: {
  items: CartItem[];
  total: number;
  customerName: string;
  referenceCode: string;
  timestamp: Date;
}) {
  return (
    <div
      style={{
        width: 360,
        padding: 24,
        background: "#FFFDFB",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        className="text-center"
        style={{ borderBottom: "2px dashed #F5EDE0", paddingBottom: 16, marginBottom: 16 }}
      >
        <p
          style={{
            fontFamily: "Poppins, system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: "#6B4226",
          }}
        >
          Rowszein's Delight
        </p>
        <p style={{ fontSize: 12, color: "#9B6644", marginTop: 4 }}>Order Summary</p>
      </div>

      {/* Order meta — name, date, time, reference */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "#9B6644" }}>Customer</span>
          <span style={{ color: "#3D3A35", fontWeight: 600 }}>{customerName}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "#9B6644" }}>Date</span>
          <span style={{ color: "#3D3A35" }}>
            {timestamp.toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "#9B6644" }}>Time</span>
          <span style={{ color: "#3D3A35" }}>
            {timestamp.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "#9B6644" }}>Reference No.</span>
          <span style={{ color: "#FF6FAE", fontWeight: 700, letterSpacing: "0.02em" }}>
            {referenceCode}
          </span>
        </div>
      </div>

      {/* Items */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderTop: "2px dashed #F5EDE0",
          paddingTop: 16,
        }}
      >
        {items.map((item) => (
          <div
            key={item.product_id}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
          >
            <span style={{ color: "#3D3A35" }}>
              {item.name} <span style={{ color: "#A8A49B" }}>× {item.quantity}</span>
            </span>
            <span style={{ color: "#3D3A35", fontWeight: 600 }}>
              {formatPeso(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div
        style={{
          borderTop: "2px dashed #F5EDE0",
          marginTop: 16,
          paddingTop: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Poppins, system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "#6B4226",
          }}
        >
          Total
        </span>
        <span
          style={{
            fontFamily: "Poppins, system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "#FF6FAE",
          }}
        >
          {formatPeso(total)}
        </span>
      </div>

      <p style={{ fontSize: 11, color: "#D1CEC7", textAlign: "center", marginTop: 16 }}>
        Show this to staff or send via message to place your order.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PANEL
   ───────────────────────────────────────────── */
interface CartPanelProps {
  open: boolean;
  items: CartItem[];
  totalAmount: number;
  onClose: () => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
  onRemove: (id: number) => void;
  onClearAll: () => void;
}

export default function CartPanel({
  open,
  items,
  totalAmount,
  onClose,
  onIncrement,
  onDecrement,
  onRemove,
  onClearAll,
}: CartPanelProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [nameError, setNameError] = useState(false);

  // Snapshot generated fresh on every successful save, per the requirement
  // that the reference number and exact timestamp are auto-generated each
  // time — not computed once on mount.
  const [receiptSnapshot, setReceiptSnapshot] = useState<{
    referenceCode: string;
    timestamp: Date;
  } | null>(null);

  const handleSaveSummary = async () => {
    if (items.length === 0) return;

    if (!customerName.trim()) {
      setNameError(true);
      toast.error("Please enter your name before saving.");
      return;
    }
    setNameError(false);

    // Generate a fresh reference + timestamp for this save, then wait for
    // the receipt to re-render with that snapshot before capturing it.
    const snapshot = {
      referenceCode: generateReferenceCode(),
      timestamp: new Date(),
    };
    setReceiptSnapshot(snapshot);

    // Let React commit the new snapshot to the hidden receipt DOM before
    // we read it into a canvas.
    await new Promise((resolve) => requestAnimationFrame(resolve));

    if (!receiptRef.current) return;

    setExporting(true);
    try {
      await downloadNode(receiptRef.current, `${snapshot.referenceCode}.png`);
      toast.success("Order summary saved.");
    } catch {
      toast.error("Couldn't save the image. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    onClearAll();
    toast.success("Cart cleared.");
  };

  return (
    <>
      {/* Off-screen receipt — always rendered so the ref is ready to capture,
          positioned far off-canvas rather than display:none (some capture
          libraries skip display:none nodes). Uses the last generated
          snapshot, or a placeholder timestamp before the first save. */}
      <div style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none" }}>
        <div ref={receiptRef}>
          <ReceiptTemplate
            items={items}
            total={totalAmount}
            customerName={customerName.trim() || "Walk-in Customer"}
            referenceCode={receiptSnapshot?.referenceCode ?? generateReferenceCode()}
            timestamp={receiptSnapshot?.timestamp ?? new Date()}
          />
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 animate-fade-in"
          style={{ background: "rgba(107, 66, 38, 0.25)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col"
        style={{
          width: "min(380px, 100vw)",
          background: "#FFFDFB",
          borderLeft: "1px solid #E8E6E1",
          boxShadow: "-8px 0 32px rgba(107, 66, 38, 0.15)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease-out",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #F5EDE0" }}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} style={{ color: "#FF6FAE" }} aria-hidden="true" />
            <p
              className="font-heading font-semibold"
              style={{ fontSize: 15, color: "#6B4226" }}
            >
              Your Order
            </p>
          </div>

          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors"
                style={{ color: "#A8A49B", fontSize: 11 }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                  (e.currentTarget as HTMLElement).style.color = "#EF4444";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#A8A49B";
                }}
                aria-label="Remove all items from cart"
              >
                <Trash size={12} aria-hidden="true" />
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: "#A8A49B" }}
              aria-label="Close cart"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div
                className="flex items-center justify-center rounded-2xl mb-4"
                style={{ width: 52, height: 52, background: "#FFF0F7" }}
              >
                <ShoppingBag size={22} style={{ color: "#FF6FAE" }} aria-hidden="true" />
              </div>
              <p
                className="font-heading font-medium"
                style={{ fontSize: 14, color: "#6B4226" }}
              >
                Your cart is empty
              </p>
              <p className="font-body mt-1" style={{ fontSize: 12, color: "#9B6644" }}>
                Add some treats from the menu to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center gap-3 p-2.5"
                  style={{
                    background: "#FFF8F0",
                    border: "1px solid #F5EDE0",
                    borderRadius: 10,
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    className="flex-shrink-0 rounded-lg overflow-hidden"
                    style={{ width: 44, height: 44, background: "#FFF0F7" }}
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Name + price */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-heading font-medium truncate"
                      style={{ fontSize: 13, color: "#6B4226" }}
                    >
                      {item.name}
                    </p>
                    <p className="font-body" style={{ fontSize: 12, color: "#9B6644" }}>
                      {formatPeso(item.price)} each
                    </p>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onDecrement(item.product_id)}
                      className="flex items-center justify-center rounded-md transition-colors"
                      style={{ width: 22, height: 22, background: "#FFFDFB", border: "1px solid #E8E6E1" }}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus size={11} style={{ color: "#7C7870" }} aria-hidden="true" />
                    </button>
                    <span
                      className="font-body text-center"
                      style={{ fontSize: 12, color: "#3D3A35", width: 16 }}
                      aria-live="polite"
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onIncrement(item.product_id)}
                      className="flex items-center justify-center rounded-md transition-colors"
                      style={{ width: 22, height: 22, background: "#FFFDFB", border: "1px solid #E8E6E1" }}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus size={11} style={{ color: "#7C7870" }} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => onRemove(item.product_id)}
                    className="flex-shrink-0 rounded-md p-1 transition-colors"
                    style={{ color: "#D1CEC7" }}
                    onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.color = "#EF4444")}
                    onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.color = "#D1CEC7")}
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — name input, total, save action */}
        {items.length > 0 && (
          <div
            className="flex-shrink-0 px-5 py-4 space-y-3"
            style={{ borderTop: "1px solid #F5EDE0" }}
          >
            {/* Customer name */}
            <div>
              <label
                className="font-body block mb-1"
                style={{ fontSize: 12, color: "#7C7870", fontWeight: 500 }}
              >
                Your Name
                <span style={{ color: "#FF6FAE", marginLeft: 3 }} aria-hidden="true">
                  *
                </span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (e.target.value.trim()) setNameError(false);
                }}
                placeholder="e.g. Juan Dela Cruz"
                className="field-input"
                style={{
                  fontSize: 13,
                  padding: "7px 10px",
                  borderColor: nameError ? "#EF4444" : undefined,
                }}
                aria-invalid={nameError}
                aria-required="true"
              />
              {nameError && (
                <p className="field-error mt-1" role="alert">
                  Please enter your name to save the order summary.
                </p>
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="font-body" style={{ fontSize: 13, color: "#7C7870" }}>
                Total
              </span>
              <span
                className="font-heading font-semibold"
                style={{ fontSize: 18, color: "#6B4226" }}
              >
                {formatPeso(totalAmount)}
              </span>
            </div>

            {/* Save */}
            <button
              onClick={handleSaveSummary}
              disabled={exporting}
              className="btn-primary w-full justify-center"
              style={{ fontSize: 13, padding: "9px 12px" }}
            >
              <Download size={14} aria-hidden="true" />
              {exporting ? "Saving…" : "Save Order Summary"}
            </button>

            <p className="font-body text-center" style={{ fontSize: 11, color: "#A8A49B" }}>
              Save and send this to place your order — no checkout needed.
            </p>
          </div>
        )}
      </div>
    </>
  );
}