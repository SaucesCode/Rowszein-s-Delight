import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useMe, useLogout } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BookOpen,
  Receipt,
  ShoppingCart,
  TrendingUp,
  LogOut,
  Menu,
  X,
  CakeSlice,
} from "lucide-react";
import { clsx } from "clsx";

/* ─────────────────────────────────────────────
   NAV CONFIG
   Single source of truth for sidebar items.
   Adding a new page = add one entry here.
   ───────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Business performance overview",
  },
  {
    to: "/ingredients",
    label: "Ingredients",
    icon: Package,
    description: "Manage your inventory ingredients",
  },
  {
    to: "/products",
    label: "Products",
    icon: CakeSlice,
    description: "Manage your dessert products",
  },
  {
    to: "/recipes",
    label: "Recipes",
    icon: BookOpen,
    description: "Define ingredients and production cost per product",
  },
  {
    to: "/expenses",
    label: "Expenses",
    icon: Receipt,
    description: "Track all business costs",
  },
  {
    to: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    description: "Track all revenue transactions",
  },
  {
    to: "/profit-margins",
    label: "Profit Margins",
    icon: TrendingUp,
    description: "Selling price vs production cost per product",
  },
] as const;

/* ─────────────────────────────────────────────
   HOOKS — derive current page meta from route
   ───────────────────────────────────────────── */
function usePageMeta() {
  const location = useLocation();

  const match = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.to),
  );

  if (!match) {
    return { title: "Rowszein's Delight", description: "" };
  }

  // Form pages get a different title
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit") || /\/\d+\/edit$/.test(location.pathname);

  if (isNew) {
    return {
      title: `Add ${match.label.replace(/s$/, "")}`,
      description: match.description,
    };
  }
  if (isEdit) {
    return {
      title: `Edit ${match.label.replace(/s$/, "")}`,
      description: match.description,
    };
  }

  return { title: match.label, description: match.description };
}

/* ─────────────────────────────────────────────
   USER AVATAR — initials in a pink circle
   ───────────────────────────────────────────── */
function UserAvatar({ username }: { username: string }) {
  const initials = username
    .split(/[\s_-]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || username[0]?.toUpperCase() || "?";

  return (
    <div
      className="flex items-center justify-center rounded-full text-xs font-semibold font-heading select-none"
      style={{
        width: 32,
        height: 32,
        background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
        color: "#FFFFFF",
        boxShadow: "0 2px 8px rgba(255,111,174,0.3)",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR NAV CONTENT
   Shared between desktop sidebar and mobile Sheet
   ───────────────────────────────────────────── */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const logout = useLogout();

  return (
    <div className="flex h-full flex-col">
      {/* Logo / shop name */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: "1px solid #F5EDE0" }}
      >
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 36,
            height: 36,
            background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
            boxShadow: "0 2px 8px rgba(255,111,174,0.25)",
          }}
        >
          <CakeSlice size={18} color="#FFFFFF" strokeWidth={2.5} />
        </div>
        <div>
          <p
            className="font-heading font-semibold leading-tight"
            style={{ fontSize: 14, color: "#6B4226" }}
          >
            Rowszein's
          </p>
          <p
            className="font-heading font-medium leading-tight"
            style={{ fontSize: 12, color: "#9B6644", marginTop: 2 }}
          >
            Delight
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "nav-item",
                isActive && "nav-item-active",
              )
            }
          >
            <Icon size={17} aria-hidden="true" strokeWidth={2} />
            <span className="text-sm">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-5" style={{ borderTop: "1px solid #F5EDE0" }}>
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="nav-item w-full text-left"
          aria-label="Logout"
        >
          <LogOut size={17} aria-hidden="true" strokeWidth={2} />
          <span className="text-sm">
            {logout.isPending ? "Logging out..." : "Logout"}
          </span>
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MOBILE SIDEBAR — simple slide-in panel
   No external dependency needed — just CSS
   ───────────────────────────────────────────── */
function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 md:hidden",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "#FFFDFB", borderRight: "1px solid #F5EDE0" }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-warm-500 hover:bg-brand-pink-light hover:text-brand-pink-dark transition-colors"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <SidebarContent onNavigate={onClose} />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   TOP NAVBAR
   ───────────────────────────────────────────── */
function TopNavbar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const { data: user } = useMe();
  const { title, description } = usePageMeta();

  return (
    <header
      className="flex items-center justify-between px-6 py-4 flex-shrink-0"
      style={{
        background: "#FFFDFB",
        borderBottom: "1px solid #F5EDE0",
        minHeight: 64,
      }}
    >
      {/* Left — hamburger (mobile) + page title */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Hamburger — only visible on mobile */}
        <button
          onClick={onMenuClick}
          className="flex-shrink-0 rounded-lg p-1.5 text-warm-500 hover:bg-brand-pink-light hover:text-brand-pink-dark transition-colors md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={20} strokeWidth={2} />
        </button>

        <div className="min-w-0">
          <h1
            className="font-heading font-semibold truncate"
            style={{ fontSize: 18, color: "#6B4226", lineHeight: 1.3 }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="truncate hidden sm:block"
              style={{ fontSize: 13, color: "#9B6644", marginTop: 3 }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right — user info */}
      {user && (
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span
            className="hidden sm:block font-body text-sm"
            style={{ color: "#7C7870" }}
          >
            {user.username}
          </span>
          <UserAvatar username={user.username} />
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   MAIN LAYOUT
   ───────────────────────────────────────────── */
export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#FFF8F0" }}
    >
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0"
        style={{
          width: 240,
          background: "#FFFDFB",
          borderRight: "1px solid #F5EDE0",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar ── */}
      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopNavbar onMenuClick={() => setMobileOpen(true)} />

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: "#FFF8F0" }}
          id="main-content"
        >
          <div className="p-6 md:p-8 max-w-1400 mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
