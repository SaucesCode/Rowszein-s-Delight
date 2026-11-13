import { Outlet } from "react-router-dom";
import DonutArt from "@/components/DonutArt";
import { BrandDonutIcon } from "@/pages/owner-home/OwnerHomeIcons";
import "@/pages/auth/auth.css";

const manilaHour = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" });

function welcomeLine(): string {
  const hour = Number(manilaHour.format(new Date()));
  if (hour < 11) return "The first batch is waiting.";
  if (hour < 17) return "Let's see how the day is going.";
  return "Time to count the day's sweetness.";
}

/** Sign-in frame: a blush "shop window" beside the form. */
export default function AuthLayout() {
  return (
    <div className="auth">
      <aside className="auth-window" aria-hidden="true">
        <div className="auth-brand">
          <BrandDonutIcon width={32} height={32} />
          <span>Rowszein's Delight</span>
        </div>
        <div className="auth-tray">
          <span className="auth-donut is-a"><DonutArt flavor="strawberry" size={132} /></span>
          <span className="auth-donut is-b"><DonutArt flavor="matcha" size={96} /></span>
          <span className="auth-donut is-c"><DonutArt flavor="choco" size={112} /></span>
          <span className="auth-donut is-d"><DonutArt flavor="ube" size={80} /></span>
        </div>
        <p className="auth-line">{welcomeLine()}</p>
      </aside>

      <main className="auth-main">
        <div className="auth-brand auth-brand-compact">
          <BrandDonutIcon width={28} height={28} aria-hidden="true" />
          <span>Rowszein's Delight</span>
        </div>
        <Outlet />
        <p className="auth-footer">© {new Date().getFullYear()} Rowszein's Delight</p>
      </main>
    </div>
  );
}
