import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "@/hooks/useAuth";
import { homeFor } from "@/lib/permissions";

export default function GuestRoute() {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <main className="workspace workspace-gate">
        <div className="workspace-card workspace-state" role="status">
          <p>Opening the shop…</p>
        </div>
      </main>
    );
  }

  if (user) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return <Outlet />;
}
