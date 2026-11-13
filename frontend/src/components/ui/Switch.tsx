import type { ReactNode } from "react";

/** Accessible on/off switch. The visible label is part of the button, so the whole row is tappable. */
export default function Switch({
  checked,
  onChange,
  children,
  disabled,
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="switch"
    >
      <span className="switch-track" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}
