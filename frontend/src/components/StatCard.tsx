import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export default function StatCard({ label, value, icon: Icon, context, emphasis, negative }: {
  label: string;
  value: string;
  icon: LucideIcon;
  context: ReactNode;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={clsx("workspace-card stat-card", emphasis && "stat-card--primary", negative && "stat-card--negative")}>
      <dt><Icon size={17} aria-hidden="true" /> {label}</dt>
      <dd className="workspace-number">{value}</dd>
      <dd className="stat-card-context">{context}</dd>
    </div>
  );
}
