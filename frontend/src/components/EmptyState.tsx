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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {/* Icon bubble */}
      <div
        className="flex items-center justify-center rounded-2xl mb-5"
        style={{
          width: 56,
          height: 56,
          background: "#FFF0F7",
          border: "1px solid #FFD6E7",
        }}
      >
        <Icon size={24} style={{ color: "#FF6FAE" }} aria-hidden="true" />
      </div>

      <p
        className="font-heading font-semibold mb-1"
        style={{ fontSize: 15, color: "#6B4226" }}
      >
        {title}
      </p>

      {description && (
        <p
          className="font-body max-w-xs mb-5"
          style={{ fontSize: 13, color: "#9B6644", lineHeight: 1.6 }}
        >
          {description}
        </p>
      )}

      {action && !description && <div className="mt-4">{action}</div>}
      {action && description && <div>{action}</div>}
    </div>
  );
}
