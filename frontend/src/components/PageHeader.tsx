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
          className="workspace-page-title font-heading font-bold truncate"
        >
          {title}
        </h1>
        {description && (
          <p className="workspace-page-description mt-2 font-body text-sm">
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
