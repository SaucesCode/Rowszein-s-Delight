import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import WorkspaceState from "./WorkspaceState";

export default function EmptyState(props: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return <WorkspaceState {...props} centered />;
}
