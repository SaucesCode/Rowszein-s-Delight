import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      {/* Icon bubble */}
      <div
        className="flex items-center justify-center rounded-2xl mb-6"
        style={{
          width: 64,
          height: 64,
          background: "#FFF0F7",
          border: "2px solid #FFD6E7",
        }}
      >
        <Icon size={28} style={{ color: "#FF6FAE" }} strokeWidth={2} aria-hidden="true" />
      </div>

      <p
        className="font-heading font-semibold mb-2"
        style={{ fontSize: 18, color: "#6B4226", fontWeight: 700 }}
      >
        {title}
      </p>

      {description && (
        <p
          className="font-body max-w-sm mb-6"
          style={{ fontSize: 14, color: "#9B6644", lineHeight: 1.6 }}
        >
          {description}
        </p>
      )}

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
