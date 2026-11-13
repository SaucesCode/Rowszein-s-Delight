import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import { displayName } from "@/lib/utils";
import { useHubSnapshot } from "./owner-home/useHubSnapshot";
import { AttentionSection, TodaySection, WeekStrip } from "./owner-home/HubParts";
import "./owner-home/owner-home.css";

const manilaHour = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" });
const manilaDay = new Intl.DateTimeFormat("en-PH", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Manila" });

function greetingFor(now: Date): string {
  const hour = Number(manilaHour.format(now));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function OwnerHomePage() {
  const { data: user } = useMe();
  const now = useMemo(() => new Date(), []);
  const snapshot = useHubSnapshot(now);
  const canSell = can(user, "sales.create");

  return (
    <div className="home" data-docked={canSell || undefined}>
      <header className="home-head">
        <div>
          <p className="home-date">{manilaDay.format(now)}</p>
          <h1 className="type-page">{greetingFor(now)}, {displayName(user?.username, "Rose")}</h1>
        </div>
        <div className="home-actions">
          {can(user, "expenses.manage") && (
            <Link to="/expenses/new" className="btn-ghost">Log an expense</Link>
          )}
          {canSell && (
            <Link to="/sales/new" className="btn-primary home-record">
              <Plus size={20} strokeWidth={2} aria-hidden="true" />
              Record a sale
            </Link>
          )}
        </div>
      </header>

      <div className="home-grid">
        <TodaySection snapshot={snapshot} />
        <AttentionSection snapshot={snapshot} />
        <WeekStrip snapshot={snapshot} showProfit={can(user, "finance.read")} />
      </div>
    </div>
  );
}
