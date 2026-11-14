import { CalendarOff, Clock, MapPin, Wallet } from "lucide-react";
import type { CSSProperties } from "react";
import {
  DEFAULT_CONTACT,
  PAYMENT_LABELS,
  cutoffSentence,
  dayOffLabel,
  feeLabel,
  groupHours,
  listNames,
} from "@/lib/shopSettings";
import type { PublicShopSettings } from "@/types/shopSettings.types";
import { Ornament } from "./ShopIcons";

const DEFAULT_TOWNS = ["Lucena City", "Tayabas", "Sariaya"];
const DAYS_OFF_SHOWN = 3;

/** Where and when the shop delivers, from the owner's Shop settings. Sits below the fold, so loading can't jolt the page. */
export default function DeliveryInfo({ settings, failed }: { settings?: PublicShopSettings; failed: boolean }) {
  const towns = settings?.towns ?? [];
  const lede = settings
    ? towns.length
      ? `We deliver around ${listNames(towns.map(town => town.name))}.`
      : "Message us to ask where we deliver."
    : `We deliver around ${listNames(DEFAULT_TOWNS)}.`;

  return (
    <section id="delivery" className="delivery" aria-labelledby="delivery-title">
      <div className="how-head" data-reveal="">
        <Ornament className="shop-ornament" />
        <h2 id="delivery-title" className="how-title">Delivery</h2>
        <p className="delivery-lede">{lede}</p>
      </div>

      {settings ? (
        <DeliveryCards settings={settings} />
      ) : failed ? (
        <p className="delivery-fallback">
          For delivery days and fees,{" "}
          <a href={DEFAULT_CONTACT.messenger_url} target="_blank" rel="noopener noreferrer">message us on Messenger</a>.
        </p>
      ) : (
        <div className="delivery-cards" aria-busy="true">
          {[0, 1].map(index => <span key={index} className="skeleton delivery-skeleton" aria-hidden="true" />)}
          <span className="sr-only" role="status">Loading delivery details</span>
        </div>
      )}
    </section>
  );
}

function DeliveryCards({ settings }: { settings: PublicShopSettings }) {
  const hours = groupHours(settings.hours);
  const daysOff = settings.days_off.slice(0, DAYS_OFF_SHOWN);
  const payments = settings.payment_methods.map(method => PAYMENT_LABELS[method]);

  return (
    <div className="delivery-cards">
      {settings.towns.length > 0 && (
        <article className="delivery-card" data-reveal="" style={{ "--reveal-i": 0 } as CSSProperties}>
          <h3 className="delivery-card-title"><MapPin size={18} aria-hidden="true" /> Where we deliver</h3>
          <ul className="delivery-list">
            {settings.towns.map(town => (
              <li key={town.id}>
                <span>{town.name}</span>
                <span className="delivery-fee">{feeLabel(town.fee)}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      <article className="delivery-card" data-reveal="" style={{ "--reveal-i": 1 } as CSSProperties}>
        <h3 className="delivery-card-title"><Clock size={18} aria-hidden="true" /> When</h3>
        {hours && hours.length > 0 && (
          <ul className="delivery-list">
            {hours.map(group => (
              <li key={group.days}>
                <span>{group.days}</span>
                <span className="num">{group.time}</span>
              </li>
            ))}
          </ul>
        )}
        {hours && hours.length === 0 && <p>Message us for delivery days.</p>}
        <p className="delivery-cutoff">{cutoffSentence(settings.lead_days, settings.order_cutoff)}</p>
        {daysOff.length > 0 && (
          <div className="delivery-days-off">
            <p className="delivery-subtitle"><CalendarOff size={16} aria-hidden="true" /> No deliveries</p>
            <ul>
              {daysOff.map(day => <li key={`${day.starts}-${day.ends}`}>{dayOffLabel(day)}</li>)}
            </ul>
          </div>
        )}
      </article>

      {payments.length > 0 && (
        <article className="delivery-card" data-reveal="" style={{ "--reveal-i": 2 } as CSSProperties}>
          <h3 className="delivery-card-title"><Wallet size={18} aria-hidden="true" /> Paying</h3>
          <p>{listNames(payments)}</p>
        </article>
      )}
    </div>
  );
}
