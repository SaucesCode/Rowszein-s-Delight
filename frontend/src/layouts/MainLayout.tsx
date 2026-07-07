import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useMe, useLogout } from "@/hooks/useAuth";
import {
  LogOut,
  Menu,
  X,
  CakeSlice,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { clsx } from "clsx";
import { NAV_GROUPS, FLAT_NAV_ITEMS } from "@/config/navigation";

/* ─────────────────────────────────────────────
   PAGE META — drives the browser tab title only.
   The visible heading lives in each page's own
   <PageHeader />, so we don't render a second,
   duplicate title in the topbar.
   ───────────────────────────────────────────── */
function usePageTitle() {
  const location = useLocation();

  useEffect(() => {
    const match = FLAT_NAV_ITEMS.find(item => location.pathname.startsWith(item.to));
    const base = match?.label ?? "Rowszein's Delight";

    const isNew = location.pathname.endsWith("/new");
    const isEdit =
      location.pathname.endsWith("/edit") || /\/\d+\/edit$/.test(location.pathname);

    const suffix = isNew ? ` · Add` : isEdit ? ` · Edit` : "";
    document.title = `${base}${suffix} — Rowszein's Delight`;
  }, [location.pathname]);
}

/* ─────────────────────────────────────────────
   USER AVATAR
   ───────────────────────────────────────────── */
function UserAvatar({ username }: { username: string }) {
  const initials =
    username
      .split(/[\s_-]/)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? "")
      .join("") ||
    username[0]?.toUpperCase() ||
    "?";

  return (
    <div
      className="flex items-center justify-center rounded-lg text-xs font-semibold font-heading select-none flex-shrink-0"
      style={{ width: 36, height: 36, background: "#FFF0F7", color: "#E5528A" }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/* ─────────────────────────────────────────────
   NAV RAIL ITEM
   Handles both the expanded (icon + label) and
   collapsed (icon-only, with a real tooltip —
   not a native title attr, which many screen
   readers skip) presentations.
   ───────────────────────────────────────────── */
function NavRailItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: (typeof FLAT_NAV_ITEMS)[number];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={clsx(
        "group relative flex items-center rounded-lg font-body text-sm transition-colors duration-150",
        collapsed ? "justify-center w-11 h-11 mx-auto" : "gap-3 px-3 py-2.5",
      )}
      style={({ isActive }) => ({
        background: isActive ? "#FFF0F7" : "transparent",
        fontWeight: isActive ? 600 : 500,
      })}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 6,
                bottom: 6,
                width: 3,
                borderRadius: 4,
                background: "#FF6FAE",
              }}
            />
          )}

          <Icon
            size={19}
            strokeWidth={2}
            aria-hidden="true"
            style={{ color: isActive ? "#E5528A" : "#9B6644", flexShrink: 0 }}
          />

          {!collapsed && (
            <span className="truncate" style={{ color: isActive ? "#6B4226" : "#7C5A3D" }}>
              {item.label}
            </span>
          )}

          {collapsed && (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 -translate-x-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
              style={{ background: "#6B4226", color: "#FFFDFB" }}
            >
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR CONTENT — shared between the fixed
   desktop rail and the mobile drawer.
   ───────────────────────────────────────────── */
function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const logout = useLogout();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          "group flex items-center border-b flex-shrink-0 transition-colors hover:bg-[#FFF8F0]",
          collapsed ? "justify-center py-5" : "gap-3 px-4 py-5",
        )}
        style={{ borderColor: "#F5EDE0" }}
        title={collapsed ? "View live shop" : undefined}
      >
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 38, height: 38, background: "#FF6FAE" }}
        >
          <CakeSlice size={19} color="#FFFFFF" strokeWidth={2.25} aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p
              className="font-heading font-semibold leading-tight truncate"
              style={{ fontSize: 14, color: "#6B4226" }}
            >
              Rowszein's Delight
            </p>
            <p
              className="font-body leading-tight"
              style={{ fontSize: 11.5, color: "#9B6644" }}
            >
              Owner Panel
            </p>
          </div>
        )}
        {!collapsed && (
          <ExternalLink
            size={13}
            strokeWidth={2}
            style={{ color: "#D1CEC7" }}
            className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </a>

      {/* Nav groups */}
      <nav
        className={clsx("flex-1 overflow-y-auto py-4 space-y-1", collapsed ? "px-2" : "px-3")}
        aria-label="Main navigation"
      >
        {NAV_GROUPS.map((group, groupIndex) => (
          <div
            key={group.label ?? `group-${groupIndex}`}
            className={groupIndex > 0 ? "pt-3" : ""}
          >
            {group.label && !collapsed && (
              <p
                className="font-body font-semibold uppercase px-3 mb-1.5"
                style={{ fontSize: 10.5, letterSpacing: "0.06em", color: "#B8A98D" }}
              >
                {group.label}
              </p>
            )}
            {group.label && collapsed && (
              <div
                className="mx-3 my-2 border-t"
                style={{ borderColor: "#F5EDE0" }}
                aria-hidden="true"
              />
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavRailItem
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div
        className={clsx("border-t py-3 flex-shrink-0", collapsed ? "px-2" : "px-3")}
        style={{ borderColor: "#F5EDE0" }}
      >
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className={clsx(
            "group relative flex items-center rounded-lg font-body text-sm font-medium w-full transition-colors duration-150 hover:bg-[#FEF2F2]",
            collapsed ? "justify-center w-11 h-11 mx-auto" : "gap-3 px-3 py-2.5",
          )}
          style={{ color: "#9B6644" }}
          aria-label="Logout"
        >
          <LogOut size={19} strokeWidth={2} aria-hidden="true" className="flex-shrink-0" />
          {!collapsed && <span>{logout.isPending ? "Logging out…" : "Logout"}</span>}
          {collapsed && (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 -translate-x-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
              style={{ background: "#6B4226", color: "#FFFDFB" }}
            >
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MOBILE DRAWER — always expanded (no icon-only
   mode on touch), closes on backdrop click or Escape.
   ───────────────────────────────────────────── */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden animate-fade-in"
          style={{ background: "rgba(107, 66, 38, 0.28)" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-72 md:hidden transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "#FFFDFB", borderRight: "1px solid #F5EDE0" }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute right-3 top-4 z-10 rounded-lg p-2 transition-colors"
          style={{ color: "#9B6644" }}
          aria-label="Close menu"
        >
          <X size={19} strokeWidth={2} aria-hidden="true" />
        </button>

        <SidebarContent collapsed={false} onNavigate={onClose} />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   TOPBAR — slim utility strip only. The page
   heading lives in each page's own PageHeader.
   ───────────────────────────────────────────── */
function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { data: user } = useMe();

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-3 flex-shrink-0 border-b"
      style={{ background: "#FFFDFB", borderColor: "#F5EDE0", minHeight: 60 }}
    >
      <button
        onClick={onMenuClick}
        className="flex-shrink-0 rounded-lg p-2 transition-colors md:hidden"
        style={{ color: "#9B6644" }}
        aria-label="Open navigation menu"
      >
        <Menu size={20} strokeWidth={2} />
      </button>

      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body font-medium transition-colors hover:bg-[#FFF0F7]"
        style={{ fontSize: 13, color: "#9B6644" }}
      >
        View live shop
        <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
      </a>

      <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
        {user && (
          <>
            <p
              className="hidden sm:block font-body font-medium truncate max-w-[140px]"
              style={{ fontSize: 13.5, color: "#6B4226" }}
            >
              {user.username}
            </p>
            <UserAvatar username={user.username} />
          </>
        )}
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────
   MAIN LAYOUT
   ───────────────────────────────────────────── */
export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  usePageTitle();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#FFF8F0" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ease-out relative"
        style={{
          width: collapsed ? 72 : 232,
          background: "#FFFDFB",
          borderRight: "1px solid #F5EDE0",
        }}
      >
        <SidebarContent collapsed={collapsed} />

        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-[52px] hidden md:flex items-center justify-center rounded-full transition-colors"
          style={{
            width: 24,
            height: 24,
            background: "#FFFDFB",
            border: "1px solid #E8E6E1",
            color: "#9B6644",
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight size={13} strokeWidth={2.5} />
          ) : (
            <ChevronLeft size={13} strokeWidth={2.5} />
          )}
        </button>
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} />

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: "#FFF8F0" }}
          id="main-content"
        >
          <div className="p-5 md:p-8 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
