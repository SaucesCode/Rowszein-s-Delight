interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6 mb-8">
      <div className="min-w-0 flex-1">
        <h1
          className="font-heading font-semibold truncate"
          style={{ fontSize: 24, color: "#6B4226", lineHeight: 1.3, fontWeight: 700 }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 font-body text-sm" style={{ color: "#9B6644" }}>
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
