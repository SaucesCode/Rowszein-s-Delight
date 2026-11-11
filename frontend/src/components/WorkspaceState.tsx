import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export default function WorkspaceState({ icon: Icon, title, description, action, primary, centered, alert }: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  primary?: boolean;
  centered?: boolean;
  alert?: boolean;
}) {
  const Heading = primary ? "h1" : "h2";
  return (
    <div className={clsx("workspace-state", centered && "workspace-state--centered")}>
      {Icon && <Icon className="workspace-state-icon" size={24} aria-hidden="true" />}
      <Heading>{title}</Heading>
      {description && <p role={alert ? "alert" : undefined}>{description}</p>}
      {action}
    </div>
  );
}
