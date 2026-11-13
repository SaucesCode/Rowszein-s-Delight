import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, ExternalLink, House, LogOut, Menu, X } from "lucide-react";
import { useMe, useLogout } from "@/hooks/useAuth";
import { can, homeFor } from "@/lib/permissions";
import { displayName } from "@/lib/utils";
import { OWNER_SECTIONS, ownerTrail } from "@/config/navigation";
import { BrandDonutIcon } from "@/pages/owner-home/OwnerHomeIcons";
import "./owner-layout.css";

const DESKTOP_QUERY = "(min-width: 1024px)";

function initialsOf(name: string): string {
  return (
    name
      .split(/[\s_.-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase() || "R"
  );
}

function Brand({ to }: { to: string }) {
  return (
    <Link to={to} className="shell-brand" aria-label="Rowszein's Delight, go home">
      <BrandDonutIcon className="shell-brand-mark" width={28} height={28} aria-hidden="true" />
      <span className="shell-brand-name">Rowszein's Delight</span>
    </Link>
  );
}

/** Nav list, shop link and account, shared by the desktop sidebar and the phone drawer. */
function SidebarContent({ pathname }: { pathname: string }) {
  const { data: user } = useMe();
  const logout = useLogout();
  const home = homeFor(user);
  const name = displayName(user?.username);
  const activeTo = pathname === home ? home : ownerTrail(pathname)[0]?.to;

  const items = [
    ...(home === "/home" ? [{ to: "/home", title: "Home", icon: House }] : []),
    ...OWNER_SECTIONS.filter(section => can(user, section.capability)),
  ];

  return (
    <>
      <nav aria-label="Main" className="shell-nav">
        <ul>
          {items.map(item => {
            const Icon = item.icon;
            const isActive = item.to === activeTo;
            return (
              <li key={item.to}>
                <Link to={item.to} className="shell-nav-link" aria-current={isActive ? "page" : undefined}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shell-footer">
        <a href="/" target="_blank" rel="noopener noreferrer" className="shell-footer-link">
          <ExternalLink size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>Visit the shop</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>

        <div className="shell-account">
          <span className="shell-avatar" aria-hidden="true">{initialsOf(name)}</span>
          <span className="shell-account-name">
            <span className="sr-only">Signed in as </span>
            {name}
          </span>
          <button
            type="button"
            className="shell-signout"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-busy={logout.isPending}
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{logout.isPending ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </div>
    </>
  );
}

/** Shown on form-level pages only; the sidebar already says which section you're in. */
function BackLink({ pathname }: { pathname: string }) {
  const trail = ownerTrail(pathname);
  if (trail.length < 2) return null;
  const parent = trail[trail.length - 2];

  return (
    <Link to={parent.to} className="shell-back">
      <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      <span>Back to {parent.label}</span>
    </Link>
  );
}

/** Owner chrome: sidebar on desktop, top bar + drawer on smaller screens. */
export function OwnerShell({ children }: { children: ReactNode }) {
  const { data: user } = useMe();
  const { pathname } = useLocation();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const home = homeFor(user);

  useEffect(() => {
    drawerRef.current?.close();
  }, [pathname]);

  useEffect(() => {
    const page = pathname === "/home" ? "Home" : ownerTrail(pathname).at(-1)?.label;
    document.title = page ? `${page} | Rowszein's Delight` : "Rowszein's Delight";
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const closeOnDesktop = () => {
      if (desktop.matches) drawerRef.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="shell-root">
      <a href="#main-content" className="shell-skip">Skip to content</a>

      <aside className="shell-sidebar">
        <Brand to={home} />
        <SidebarContent pathname={pathname} />
      </aside>

      <header className="shell-topbar">
        <Brand to={home} />
        <button
          type="button"
          className="shell-menu-button"
          aria-haspopup="dialog"
          onClick={() => drawerRef.current?.showModal()}
        >
          <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </header>

      <dialog
        ref={drawerRef}
        className="shell-drawer"
        aria-label="Menu"
        onClick={event => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="shell-drawer-panel">
          <div className="shell-drawer-head">
            <Brand to={home} />
            <button type="button" className="shell-drawer-close" onClick={() => drawerRef.current?.close()}>
              <X size={22} strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          <SidebarContent pathname={pathname} />
        </div>
      </dialog>

      <main id="main-content" className="shell-main" tabIndex={-1}>
        <BackLink pathname={pathname} />
        {children}
      </main>
    </div>
  );
}

/** Shown inside the shell while a page's code downloads, so the sidebar never blinks. */
function PageLoading() {
  return (
    <div className="grid gap-3" role="status">
      <span className="skeleton block h-10 w-64 max-w-full" aria-hidden="true" />
      <span className="skeleton block h-4 w-80 max-w-full" aria-hidden="true" />
      <span className="sr-only">Loading the page</span>
    </div>
  );
}

export default function OwnerLayout() {
  return (
    <OwnerShell>
      <Suspense fallback={<PageLoading />}>
        <Outlet />
      </Suspense>
    </OwnerShell>
  );
}
