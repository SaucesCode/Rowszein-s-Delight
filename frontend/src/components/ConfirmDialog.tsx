import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { clsx } from "clsx";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Turns the confirm button red — use for destructive actions */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /* Focus cancel button when dialog opens */
  useEffect(() => {
    if (open) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [open]);

  /* Close on Escape key */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  /* Trap focus inside dialog */
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(107, 66, 38, 0.25)", backdropFilter: "blur(2px)" }}
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
      aria-hidden="true"
    >
      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="w-full max-w-sm animate-slide-up"
        style={{
          background: "#FFFDFB",
          border: "1px solid #E8E6E1",
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(107, 66, 38, 0.18)",
          overflow: "hidden",
        }}
        aria-hidden="false"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between p-5"
          style={{ borderBottom: "1px solid #F5EDE0" }}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5"
              style={{
                width: 36,
                height: 36,
                background: destructive ? "#FEF2F2" : "#FFF0F7",
                border: `1px solid ${destructive ? "#FECACA" : "#FFD6E7"}`,
              }}
            >
              <AlertTriangle
                size={17}
                style={{ color: destructive ? "#EF4444" : "#FF6FAE" }}
                aria-hidden="true"
              />
            </div>

            <div>
              <h2
                id="confirm-title"
                className="font-heading font-semibold"
                style={{ fontSize: 15, color: "#6B4226", lineHeight: 1.3 }}
              >
                {title}
              </h2>
              <p
                id="confirm-desc"
                className="font-body mt-1"
                style={{ fontSize: 13, color: "#9B6644", lineHeight: 1.6 }}
              >
                {description}
              </p>
            </div>
          </div>

          {/* Close X */}
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost"
            style={{ fontSize: 13, padding: "7px 16px" }}
          >
            {cancelLabel}
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className={clsx("btn-primary", destructive && "btn-danger", "font-body")}
            style={
              destructive
                ? { fontSize: 13, padding: "7px 16px" }
                : { fontSize: 13, padding: "7px 16px" }
            }
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
