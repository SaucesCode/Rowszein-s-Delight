import { AlertTriangle } from "lucide-react";

interface MissingRecipeBannerProps {
  productNames: string[];
  onClick: () => void;
}

/**
 * Same visual + interaction pattern as the Dashboard's low-stock alert
 * (.alert-low-stock) — a full-width, clickable banner rather than a
 * passive message, so "needs attention" always looks and behaves the
 * same way across the app.
 */
export default function MissingRecipeBanner({
  productNames,
  onClick,
}: MissingRecipeBannerProps) {
  if (productNames.length === 0) return null;

  const preview = productNames.slice(0, 4).join(", ");
  const extra = productNames.length > 4 ? ` +${productNames.length - 4} more` : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="alert-low-stock w-full text-left animate-slide-up cursor-pointer hover:bg-yellow-100 transition-colors mb-6"
      aria-label="View products without a recipe"
    >
      <AlertTriangle
        size={20}
        className="flex-shrink-0 mt-0.5"
        strokeWidth={2}
        aria-hidden="true"
      />
      <div>
        <p className="font-heading font-semibold text-sm">
          {productNames.length} product{productNames.length !== 1 ? "s don't" : " doesn't"}{" "}
          have a recipe yet
        </p>
        <p className="font-body text-xs mt-1">
          {preview}
          {extra} — add a recipe to calculate their production cost.
        </p>
      </div>
    </button>
  );
}
