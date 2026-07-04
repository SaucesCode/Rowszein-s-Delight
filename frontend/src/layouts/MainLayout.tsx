import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useMe, useLogout } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Package,
  BookOpen,
  Receipt,
  ShoppingCart,
  TrendingUp,
  LogOut,
  Menu,
  X,
  CakeSlice,
  ChevronLeft,
} from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ingredients", label: "Ingredients", icon: Package },
  { to: "/products", label: "Products", icon: CakeSlice },
  { to: "/recipes", label: "Recipes", icon: BookOpen },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/profit-margins", label: "Profit Margins", icon: TrendingUp },
] as const;

function usePageMeta() {
  const location = useLocation();
  const match = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to));

  if (!match) {
    return { title: "Rowszein's Delight", description: "" };
  }

  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit") || /\/\d+\/edit$/.test(location.pathname);

  if (isNew) {
    return { title: `Add ${match.label.replace(/s$/, "")}`, description: "" };
  }
  if (isEdit) {
    return { title: `Edit ${match.label.replace(/s$/, "")}`, description: "" };
  }

  return { title: match.label, description: "" };
}

function UserAvatar({ username }: { username: string }) {
  const initials = username
    .split(/[\s_-]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || username[0]?.toUpperCase() || "?";

  return (
    <div
      className="flex items-center justify-center rounded-lg text-xs font-semibold font-heading select-none"
      style={{
        width: 36,
        height: 36,
        background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
        color: "#ffffff",
        boxShadow: "0 4px 12px rgba(236, 72, 153, 0.25)",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const logout = useLogout();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-gray-200">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
            boxShadow: "0 4px 12px rgba(236, 72, 153, 0.25)",
          }}
        >
          <CakeSlice size={20} color="#ffffff" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div>
            <p
              className="font-heading font-bold leading-tight"
              style={{ fontSize: 15, color: "#0f172a" }}
            >
              Rowszein's
            </p>
            <p
              className="font-heading font-semibold leading-tight"
              style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}
            >
              Delight
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-pink-100 to-pink-50 text-ec4899 font-semibold"
                  : "text-64748b hover:bg-gray-100 hover:text-0f172a",
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-4 border-t border-gray-200">
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm font-medium w-full transition-all",
            "text-64748b hover:bg-red-50 hover:text-ef4444",
          )}
          aria-label="Logout"
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={18} strokeWidth={2} aria-hidden="true" className="flex-shrink-0" />
          {!collapsed && <span>{logout.isPending ? "Logging out..." : "Logout"}</span>}
        </button>
      </div>
    </div>
  );
}

function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 md:hidden",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "#ffffff", borderRight: "1px solid #e2e8f0" }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Close menu"
        >
          <X size={20} strokeWidth={2} />
        </button>

        <SidebarContent collapsed={false} onNavigate={onClose} />
      </div>
    </>
  );
}

function TopNavbar({
  onMenuClick,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const { data: user } = useMe();
  const { title } = usePageMeta();

  return (
    <header
      className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-gray-200"
      style={{
        background: "#ffffff",
        minHeight: 64,
      }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={20} strokeWidth={2} />
        </button>

        <button
          onClick={onToggleSidebar}
          className="hidden md:flex flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            size={20}
            strokeWidth={2}
            style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        <div className="min-w-0">
          <h1
            className="font-heading font-bold truncate"
            style={{ fontSize: 20, color: "#0f172a" }}
          >
            {title}
          </h1>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          <div className="hidden sm:flex items-center gap-3">
            <div>
              <p
                className="font-body text-sm font-medium"
                style={{ color: "#0f172a" }}
              >
                {user.username}
              </p>
            </div>
          </div>
          <UserAvatar username={user.username} />
        </div>
      )}
    </header>
  );
}

export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#fafbfc" }}
    >
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ease-out"
        style={{
          width: sidebarCollapsed ? 80 : 260,
          background: "#ffffff",
          borderRight: "1px solid #e2e8f0",
        }}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile sidebar */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopNavbar
          onMenuClick={() => setMobileOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: "#fafbfc" }}
          id="main-content"
        >
          <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
