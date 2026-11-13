import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useMe, useLogout } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import { manilaDate } from "@/lib/dateRanges";
import {
  BrandDonutIcon,
  ExternalLinkIcon,
} from "@/pages/owner-home/OwnerHomeIcons";
import "./owner-layout.css";

export default function OwnerLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const location = useLocation();

  const isOwner = can(user, "finance.read");

  // Manila Date & Greeting Calculations
  const now = useMemo(() => new Date(), []);
  const todayManila = useMemo(() => manilaDate(now), [now]);

  const greetingDateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      }).format(now);
    } catch {
      return todayManila;
    }
  }, [now, todayManila]);

  // Initials for avatar
  const username = user?.username ?? "";
  const initials = username
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "RO";

  return (
    <div className="owner-layout-root">
      {/* ─────────────────────────────────────────────────────────────
           PERSISTENT BOUTIQUE BRANDING HEADER (NO TABS)
           Brand Insignia links directly back to Control Hub (/home).
           ───────────────────────────────────────────────────────────── */}
      <header className="owner-header">
        <Link to="/home" className="owner-brand-group" aria-label="Back to Rowszein's Delight Control Hub">
          <div className="owner-brand-insignia">
            <BrandDonutIcon width={22} height={22} />
          </div>
          <div className="owner-brand-titles">
            <span className="owner-brand-name">Rowszein's Delight</span>
            <span className="owner-brand-tagline">Bakery Management</span>
          </div>
        </Link>

        <div className="owner-greeting-pill" aria-label="Current Owner Session">
          <span className="owner-greeting-dot" aria-hidden="true"></span>
          <span>Good morning, {user?.username ?? "Rose"} &bull; {greetingDateStr}</span>
        </div>

        <div className="owner-header-actions">
          {isOwner && (
            <Link
              to="/analytics"
              className={`owner-btn-subtle-link${location.pathname === "/analytics" ? " active" : ""}`}
              aria-label="Open detailed financial analytics dashboard"
            >
              <span>Analytics</span>
              <ExternalLinkIcon width={12} height={12} aria-hidden="true" />
            </Link>
          )}

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="owner-btn-subtle-link"
            aria-label="Visit customer storefront (opens in new tab)"
          >
            <span>Visit Shop</span>
            <ExternalLinkIcon width={12} height={12} aria-hidden="true" />
          </a>

          <div className="owner-profile-badge" aria-label={`Signed in as ${user?.username ?? "Owner"}`}>
            <div className="owner-avatar" aria-hidden="true">
              {initials}
            </div>
            <span className="owner-user-name">{user?.username ?? "Owner"}</span>
          </div>

          <button
            type="button"
            className="owner-btn-logout"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-label="Logout of bakery management session"
          >
            {logout.isPending ? "Logging out…" : "Logout"}
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
           PAGE CONTENT OUTLET (The 6 cards on /home ARE the navigation)
           ───────────────────────────────────────────────────────────── */}
      <main className="owner-main-container">
        <Outlet />
      </main>
    </div>
  );
}
