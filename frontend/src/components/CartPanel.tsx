import { useRef, useState } from "react";
import { X, Plus, Minus, Trash2, Download, ShoppingBag, Trash, ClipboardList } from "lucide-react";
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

    const snapshot = {
      referenceCode: generateReferenceCode(),
      timestamp: new Date(),
    };
    setReceiptSnapshot(snapshot);

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
      {/* Off-screen receipt — always rendered so the ref is ready to capture */}
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
          style={{ background: "rgba(107, 66, 38, 0.32)", backdropFilter: "blur(3px)" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col landing-page"
        style={{
          width: "min(400px, 100vw)",
          background: "#FFF8F0",
          boxShadow: "-12px 0 40px rgba(107, 66, 38, 0.18)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease-out",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ background: "#FFFDFB", borderBottom: "1px solid #F5EDE0" }}
        >
          <div>
            <h2 className="font-heading font-bold" style={{ fontSize: 22, color: "#6B4226" }}>
              Your Order
            </h2>
            <p className="font-body" style={{ fontSize: 12, color: "#9B6644" }}>
              {items.reduce((sum, i) => sum + i.quantity, 0)} item
              {items.reduce((sum, i) => sum + i.quantity, 0) !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors"
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
              className="flex items-center justify-center rounded-full transition-colors"
              style={{ width: 36, height: 36, background: "#FFF0F7", color: "#6B4226" }}
              aria-label="Close cart"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div
                className="flex items-center justify-center rounded-full mb-4"
                style={{ width: 64, height: 64, background: "#FFF0F7" }}
              >
                <ShoppingBag size={26} style={{ color: "#FF6FAE" }} aria-hidden="true" />
              </div>
              <p className="font-heading font-bold" style={{ fontSize: 17, color: "#6B4226" }}>
                Your cart is empty
              </p>
              <p className="font-body mt-1" style={{ fontSize: 13, color: "#9B6644" }}>
                Add some treats from the menu to get started.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex gap-3 p-3"
                    style={{ background: "#FFFDFB", border: "1px solid #F5EDE0", borderRadius: 20 }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="flex-shrink-0 rounded-2xl overflow-hidden"
                      style={{ width: 64, height: 64, background: "#FFF0F7" }}
                    >
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="font-heading font-bold truncate"
                          style={{ fontSize: 14, color: "#6B4226" }}
                        >
                          {item.name}
                        </p>
                        <button
                          onClick={() => onRemove(item.product_id)}
                          className="flex-shrink-0 transition-colors"
                          style={{ color: "#D1CEC7" }}
                          onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.color = "#EF4444")}
                          onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.color = "#D1CEC7")}
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="font-body" style={{ fontSize: 12, color: "#9B6644" }}>
                        {formatPeso(item.price)} each
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div
                          className="flex items-center gap-1 rounded-full p-1"
                          style={{ background: "#FFF0F7" }}
                        >
                          <button
                            onClick={() => onDecrement(item.product_id)}
                            className="flex items-center justify-center rounded-full"
                            style={{ width: 24, height: 24, background: "#FFFDFB", border: "1px solid #FFD6E7" }}
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus size={12} style={{ color: "#E5528A" }} aria-hidden="true" />
                          </button>
                          <span
                            className="font-heading font-bold text-center"
                            style={{ fontSize: 13, color: "#6B4226", width: 20 }}
                            aria-live="polite"
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onIncrement(item.product_id)}
                            className="flex items-center justify-center rounded-full"
                            style={{ width: 24, height: 24, background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)" }}
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus size={12} color="#FFFFFF" aria-hidden="true" />
                          </button>
                        </div>
                        <span
                          className="font-heading font-bold"
                          style={{ fontSize: 14, color: "#FF6FAE" }}
                        >
                          {formatPeso(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order summary preview — shown before any save/download action */}
              <div
                className="rounded-2xl p-4 mt-5"
                style={{ background: "#FFF0F7" }}
              >
                <div className="flex items-center gap-1.5 mb-2.5">
                  <ClipboardList size={13} style={{ color: "#E5528A" }} aria-hidden="true" />
                  <p
                    className="font-body font-bold uppercase"
                    style={{ fontSize: 10.5, letterSpacing: "0.06em", color: "#E5528A" }}
                  >
                    Order Summary
                  </p>
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex items-baseline justify-between gap-2 font-body"
                      style={{ fontSize: 12.5, color: "#6B4226" }}
                    >
                      <span className="truncate">
                        • {item.quantity}× {item.name}
                      </span>
                      <span style={{ flexShrink: 0, fontWeight: 600 }}>
                        {formatPeso(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="flex items-center justify-between mt-2.5 pt-2.5"
                  style={{ borderTop: "1px dashed #FFD6E7" }}
                >
                  <span className="font-body font-bold" style={{ fontSize: 12.5, color: "#6B4226" }}>
                    Total
                  </span>
                  <span className="font-heading font-bold" style={{ fontSize: 15, color: "#E5528A" }}>
                    {formatPeso(totalAmount)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer — name input, total, save action */}
        {items.length > 0 && (
          <div
            className="flex-shrink-0 px-6 py-5 space-y-3"
            style={{ background: "#FFFDFB", borderTop: "1px solid #F5EDE0" }}
          >
            <div>
              <label className="field-label">
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
                  padding: "9px 12px",
                  borderRadius: 12,
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

            <button
              onClick={handleSaveSummary}
              disabled={exporting}
              className="btn-primary w-full justify-center"
              style={{ fontSize: 14, padding: "13px 16px", borderRadius: 999 }}
            >
              <Download size={15} aria-hidden="true" />
              {exporting ? "Saving…" : "Save Order Summary"}
            </button>

            <p className="font-body text-center" style={{ fontSize: 11, color: "#A8A49B" }}>
              Save and send this image to place your order — no checkout needed.
            </p>
          </div>
        )}
      </div>
    </>
  );
}