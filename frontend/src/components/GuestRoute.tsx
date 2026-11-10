import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "@/hooks/useAuth";
import { homeFor } from "@/lib/permissions";

export default function GuestRoute() {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return <Outlet />;
}
