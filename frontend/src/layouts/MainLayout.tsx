import { Outlet, NavLink } from "react-router-dom";
import { useLogout } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BookOpen,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ingredients", label: "Ingredients", icon: Package },
  { to: "/products", label: "Products", icon: ShoppingBag },
  { to: "/recipes", label: "Recipes", icon: BookOpen },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/profit-margins", label: "Profit Margins", icon: TrendingUp },
];

export default function MainLayout() {
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-56 bg-white border-r flex flex-col">
        <div className="px-6 py-5 border-b">
          <span className="font-semibold text-slate-800 text-sm">Rowszein's Delight</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-100 text-slate-800"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50",
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t">
          <button
            onClick={() => logout.mutate()}
            className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
