import { Outlet } from "react-router-dom";
import { useLogout } from "@/hooks/useAuth";

export default function MainLayout() {
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-slate-800">Rowszein's Delight</span>
        <button
          onClick={() => logout.mutate()}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Logout
        </button>
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
