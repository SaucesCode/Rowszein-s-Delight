import { useMe } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { data: user } = useMe();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
      <p className="text-sm text-slate-500 mt-1">Welcome, {user?.username}</p>
    </div>
  );
}
