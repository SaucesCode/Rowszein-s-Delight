import type { ReactNode } from "react";

/** One labelled row in a grouped section: label left, control right (stacked on phones). */
export default function SettingsRow({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  const messageId = htmlFor ? `${htmlFor}-msg` : undefined;
  return (
    <div className="settings-row">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="settings-label">{label}</label>
      ) : (
        <span className="settings-label">{label}</span>
      )}
      <div className="settings-control">
        {children}
        {error ? (
          <p id={messageId} className="field-error">{error}</p>
        ) : (
          hint && <p id={messageId} className="field-hint">{hint}</p>
        )}
      </div>
    </div>
  );
}
