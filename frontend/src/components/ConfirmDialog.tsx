import { useRef, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { AlertTriangle, X } from "lucide-react";
import { clsx } from "clsx";

interface ConfirmDialogProps {
  children?: ReactNode;
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  children, open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel",
  destructive = false, loading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={next => { if (!next && !loading) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="workspace-overlay" />
        <AlertDialog.Content
          className="workspace-dialog workspace-card"
          onOpenAutoFocus={event => {
            previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            cancel.current?.focus();
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            const target = previousFocus.current;
            if (target?.isConnected) target.focus({ preventScroll: true });
            if (!target?.isConnected || document.activeElement !== target) {
              document.getElementById("main-content")?.focus({ preventScroll: true });
            }
          }}
          onEscapeKeyDown={event => { if (loading) event.preventDefault(); }}
          aria-busy={loading}
        >
          <div className="workspace-dialog-heading">
            <AlertTriangle className="workspace-state-icon mt-0.5 shrink-0" size={21} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertDialog.Title>{title}</AlertDialog.Title>
              <AlertDialog.Description>{description}</AlertDialog.Description>
            </div>
            <AlertDialog.Cancel asChild>
              <button type="button" disabled={loading} aria-label="Close dialog" className="workspace-icon-button">
                <X size={19} aria-hidden="true" />
              </button>
            </AlertDialog.Cancel>
          </div>
          {children && <div className="workspace-dialog-body">{children}</div>}
          <div className="workspace-dialog-actions">
            <AlertDialog.Cancel asChild>
              <button ref={cancel} type="button" disabled={loading} className="btn-ghost">{cancelLabel}</button>
            </AlertDialog.Cancel>
            <button type="button" onClick={onConfirm} disabled={loading} className={clsx("btn-primary", destructive && "btn-danger")}>
              {loading ? "Working…" : confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
