import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useMe } from "@/hooks/useAuth";
import { can, canVisit, homeFor } from "@/lib/permissions";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import WorkspaceState from "./WorkspaceState";

export default function ProtectedRoute() {
  const { data: user, isLoading } = useMe();
  const location = useLocation();
  const queryClient = useQueryClient();
  const previousAuthority = useRef<string | undefined>(undefined);
  const authority = user ? `${user.id}:${user.role}` : undefined;

  useEffect(() => {
    if (previousAuthority.current && previousAuthority.current !== authority) {
      void queryClient.resetQueries({ predicate: query => query.queryKey[0] !== "auth" });
    }
    previousAuthority.current = authority;
  }, [authority, queryClient]);

  if (isLoading) {
    return (
      <main className="workspace workspace-gate">
        <div className="workspace-card workspace-state" role="status">
          <p>Loading your workspace…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!can(user, "self.read") || !canVisit(user, location.pathname)) {
    return (
      <main className="workspace workspace-gate">
        <div className="workspace-card">
          <WorkspaceState
            primary
            alert
            icon={ShieldAlert}
            title="Access restricted"
            description="Your account does not have permission to open this page."
            action={<Link className="workspace-button workspace-button--primary" to={homeFor(user)}>Return to your workspace</Link>}
          />
        </div>
      </main>
    );
  }

  return <Outlet />;
}
