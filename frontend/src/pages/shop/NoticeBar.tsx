import { useState } from "react";
import { Info, PauseCircle, X } from "lucide-react";

const DISMISSED_KEY = "rowszein-notice-dismissed";

function wasDismissed(text: string): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === text;
  } catch {
    return false; // Storage blocked: show the notice; dismissing still works for this page view.
  }
}

/**
 * The owner's notice and the "orders paused" message, as a strip fixed to the bottom of the screen.
 * Fixed, so it never pushes the page down when the settings arrive. Hidden while an order dock is showing;
 * the order sheet repeats the paused message where it matters.
 */
export default function NoticeBar({ notice, paused }: { notice: string; paused: string | null }) {
  const text = [paused, notice].filter(Boolean).join(" ");
  const [dismissed, setDismissed] = useState(() => wasDismissed(text));
  if (!text || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, text);
    } catch {
      // Without storage the notice returns on the next visit, which is fine.
    }
  };

  return (
    <aside className={`shop-notice${paused ? " is-paused" : ""}`} aria-label="Shop notice">
      <div className="shop-notice-inner">
        {paused ? <PauseCircle size={20} aria-hidden="true" /> : <Info size={20} aria-hidden="true" />}
        <div className="shop-notice-text">
          {paused && <p><strong>{paused}</strong></p>}
          {notice && <p>{notice}</p>}
        </div>
        <button type="button" className="shop-notice-close" aria-label="Dismiss notice" onClick={dismiss}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
