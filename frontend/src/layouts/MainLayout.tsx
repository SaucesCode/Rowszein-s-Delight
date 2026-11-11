import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Dialog, Tooltip } from "radix-ui";
import { CakeSlice, ExternalLink, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useMe, useLogout } from "@/hooks/useAuth";
import { FLAT_NAV_ITEMS, NAV_GROUPS } from "@/config/navigation";
import { canVisit } from "@/lib/permissions";
import type { User } from "@/services/auth.services";
import "./main-layout.css";

const DESKTOP = "(min-width: 960px)";

function LinkTip({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactElement }) {
  if (!collapsed) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="workspace-tip" side="right" sideOffset={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function WorkspaceRail({ user, collapsed = false, onNavigate }: {
  user: User;
  collapsed?: boolean;
  onNavigate?: (destination: string) => void;
}) {
  const logout = useLogout();
  const groups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => canVisit(user, item.to)),
  })).filter(group => group.items.length);

  return (
    <div className="workspace-rail-body" data-collapsed={collapsed}>
      <div className="workspace-brand">
        <span className="workspace-brand-mark"><CakeSlice size={22} aria-hidden="true" /></span>
        {!collapsed && <span>Rowszein’s<br />Delight</span>}
      </div>
      <nav className="workspace-nav" aria-label="Main navigation">
        {groups.map(group => (
          <div className="workspace-nav-group" key={group.label ?? "primary"}>
            {group.label && !collapsed && <p className="workspace-nav-label">{group.label}</p>}
            {group.items.map(({ to, label, icon: Icon }) => (
              <LinkTip key={to} label={label} collapsed={collapsed}>
                <NavLink to={to} aria-label={collapsed ? label : undefined} className="workspace-nav-link" onClick={() => onNavigate?.(to)}>
                  <Icon size={18} aria-hidden="true" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              </LinkTip>
            ))}
          </div>
        ))}
      </nav>
      <div className="workspace-rail-footer">
        <LinkTip label="View live shop (opens in a new tab)" collapsed={collapsed}>
          <a className="workspace-nav-link" href="/" target="_blank" rel="noopener noreferrer" aria-label="View live shop (opens in a new tab)">
            <ExternalLink size={18} aria-hidden="true" />
            {!collapsed && <span>View live shop</span>}
          </a>
        </LinkTip>
        <LinkTip label="Logout" collapsed={collapsed}>
          <button className="workspace-nav-link" type="button" onClick={() => logout.mutate()} disabled={logout.isPending} aria-label="Logout">
            <LogOut size={18} aria-hidden="true" />
            {!collapsed && <span>{logout.isPending ? "Logging out…" : "Logout"}</span>}
          </button>
        </LinkTip>
      </div>
    </div>
  );
}

function Account({ user }: { user: User }) {
  const role = user.role === "admin" ? "Owner" : "Staff";
  const initials = user.username.split(/[\s_.-]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return (
    <div className="workspace-account">
      <span className="workspace-avatar" aria-hidden="true">{initials || "?"}</span>
      <div>
        <span className="workspace-account-name" title={user.username}>{user.username}</span>
        <span className="workspace-account-role">{role}</span>
      </div>
    </div>
  );
}

export default function MainLayout() {
  const { data: user } = useMe();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const focusDestination = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.matchMedia("(max-width: 1100px)").matches);
  const section = FLAT_NAV_ITEMS.find(item => pathname === item.to || pathname.startsWith(item.to + "/"));
  const page = section?.label ?? "Workspace";
  const detail = pathname.endsWith("/new") ? "New record" : pathname.endsWith("/edit") ? "Edit record" : undefined;

  useEffect(() => {
    document.title = [page, detail, "Rowszein’s Delight"].filter(Boolean).join(" | ");
    if (main.current) main.current.scrollTop = 0;
  }, [page, detail, pathname]);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);

  if (!user) return null;

  return (
    <Tooltip.Provider delayDuration={250}>
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="workspace workspace-shell" data-collapsed={collapsed}>
          <a className="workspace-skip" href="#main-content">Skip to main content</a>
          <aside className="workspace-rail" id="workspace-sidebar">
            <WorkspaceRail user={user} collapsed={collapsed} />
          </aside>

          <div className="workspace-body">
            <header className="workspace-topbar">
              <div className="workspace-current">
                <Dialog.Trigger asChild>
                  <button type="button" className="workspace-icon-button workspace-menu-toggle" aria-label="Open navigation menu">
                    <Menu size={20} aria-hidden="true" />
                  </button>
                </Dialog.Trigger>
                <button
                  type="button"
                  className="workspace-icon-button workspace-rail-toggle"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-controls="workspace-sidebar"
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsed(value => !value)}
                >
                  {collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
                </button>
                <div className="workspace-crumb">
                  <span>{page}</span>
                  {detail && <span className="workspace-crumb-detail"> / {detail}</span>}
                </div>
              </div>
              <Account user={user} />
            </header>
            <main id="main-content" ref={main} tabIndex={-1} className="workspace-main">
              <div className="workspace-container"><Outlet /></div>
            </main>
          </div>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="workspace-overlay" />
          <Dialog.Content
            className="workspace-drawer"
            aria-describedby={undefined}
            onCloseAutoFocus={event => {
              if (focusDestination.current) {
                event.preventDefault();
                main.current?.focus({ preventScroll: true });
              }
              focusDestination.current = false;
            }}
          >
            <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="workspace-icon-button workspace-drawer-close" aria-label="Close menu">
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
            <WorkspaceRail user={user} onNavigate={destination => {
              focusDestination.current = destination !== pathname;
              setMobileOpen(false);
            }} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Tooltip.Provider>
  );
}
