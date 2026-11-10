import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useMe } from "@/hooks/useAuth";
import { can, canVisit, homeFor } from "@/lib/permissions";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!can(user, "self.read") || !canVisit(user, location.pathname)) {
    return <div className="p-8" role="alert"><h1>Access restricted</h1><p>You do not have permission to open this page.</p><Link to={homeFor(user)}>Return to your workspace</Link></div>;
  }

  return <Outlet />;
}
