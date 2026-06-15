interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1
          className="font-heading font-semibold truncate"
          style={{ fontSize: 20, color: "#6B4226", lineHeight: 1.3 }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 font-body" style={{ fontSize: 13, color: "#9B6644" }}>
            {description}
          </p>
        )}
      </div>

      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}
