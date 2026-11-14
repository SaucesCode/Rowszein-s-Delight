import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { usePartnerPayouts, usePartners, useSavePartner } from "@/hooks/usePartners";
import { apiErrorMessage } from "@/lib/csrfTransport";
import { dateRangeError, getDateRange, getLastMonthRange, manilaDate } from "@/lib/dateRanges";
import type { Partner, PartnerOwed } from "@/types/partner.types";
import Switch from "@/components/ui/Switch";
import AmountOwed, { type OwedPeriod } from "./partners/AmountOwed";
import PartnerForm from "./partners/PartnerForm";
import PartnerPayments from "./partners/PartnerPayments";
import { balanceLabel } from "./partners/balance";
import "./boxes/boxes.css";
import "./partners/partners.css";

function PartnerRow({ partner, owed }: { partner: Partner; owed?: PartnerOwed }) {
  const id = useId();
  const save = useSavePartner();
  const [editing, setEditing] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const balance = owed ? balanceLabel(owed.still_to_pay) : null;

  return (
    <li className="partner-row">
      <div className="partner-head">
        <div className="partner-title">
          <h3 id={`${id}-name`} className="partner-name">{partner.name}</h3>
          <p className="partner-meta">
            {partner.product_count === 1 ? "1 item" : `${partner.product_count} items`}
            {partner.blurb ? ` · ${partner.blurb}` : ""}
          </p>
          {balance && <p className={`partner-balance is-${balance.tone}`} aria-live="polite">{balance.label}</p>}
        </div>
        <Switch
          checked={partner.is_active}
          disabled={save.isPending}
          onChange={next =>
            save.mutate(
              { id: partner.id, payload: { is_active: next } },
              {
                onError: error =>
                  toast.error(apiErrorMessage(error, `Couldn't ${next ? "show" : "hide"} ${partner.name}. Check the connection and try again.`)),
              },
            )
          }
        >
          In the shop
        </Switch>
      </div>
      <div className="partner-actions">
        <button type="button" className="btn-secondary" aria-expanded={paymentsOpen} aria-controls={`${id}-payments`}
          onClick={() => setPaymentsOpen(open => !open)}>
          {paymentsOpen ? "Hide payments" : "Payments"}
        </button>
        <Link to={`/products/new?partner=${partner.id}`} className="btn-secondary">
          <Plus size={18} aria-hidden="true" />
          Add an item
        </Link>
        <button type="button" className="btn-secondary" aria-expanded={editing} onClick={() => setEditing(open => !open)}>
          <Pencil size={16} aria-hidden="true" />
          Edit<span className="sr-only"> {partner.name}</span>
        </button>
      </div>
      {editing && <PartnerForm partner={partner} onDone={() => setEditing(false)} />}
      {paymentsOpen && (
        <div id={`${id}-payments`}>
          <PartnerPayments partnerId={partner.id} partnerName={partner.name} />
        </div>
      )}
    </li>
  );
}

export default function PartnersPage() {
  const partners = usePartners();
  const [adding, setAdding] = useState(false);
  const [period, setPeriod] = useState<OwedPeriod>("this_month");
  const [custom, setCustom] = useState(() => ({ date_from: manilaDate().slice(0, 8) + "01", date_to: manilaDate() }));
  const customError = period === "custom" ? dateRangeError(custom) : undefined;
  const range = useMemo(() => {
    if (period === "custom") return customError ? getDateRange("this_month") : custom;
    return period === "last_month" ? getLastMonthRange() : getDateRange(period);
  }, [period, custom, customError]);
  const payouts = usePartnerPayouts(range);
  const owedById = new Map((payouts.data?.partners ?? []).map(row => [row.id, row]));
  const list = (partners.data ?? []) as Partner[];

  return (
    <div className="boxes-page partners-page">
      <header className="page-head">
        <div>
          <h1 className="type-page">Partners</h1>
          <p className="page-lede">
            Food from collab partners, sold in the shop at their price plus your patong. Partner items never go in boxes.
          </p>
        </div>
        {!adding && (
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={20} aria-hidden="true" />
            Add a partner
          </button>
        )}
      </header>

      {adding && (
        <section className="settings-group" aria-label="New partner">
          <div className="settings-card">
            <PartnerForm onDone={() => setAdding(false)} />
          </div>
        </section>
      )}

      <section className="settings-group" aria-labelledby="partners-title">
        <h2 id="partners-title" className="settings-group-title">Your partners</h2>
        {partners.isPending && <span className="skeleton block h-24 w-full" aria-hidden="true" />}
        {partners.isError && (
          <div className="settings-card box-state" role="alert">
            <p>Couldn't load your partners.</p>
            <button type="button" className="btn-secondary" onClick={() => void partners.refetch()}>Try again</button>
          </div>
        )}
        {partners.isSuccess && list.length === 0 && (
          <div className="settings-card box-state">
            <p>No partners yet. Add one to sell their food in the shop.</p>
          </div>
        )}
        {list.length > 0 && (
          <ul className="partner-list settings-card">
            {list.map(partner => <PartnerRow key={partner.id} partner={partner} owed={owedById.get(partner.id)} />)}
          </ul>
        )}
      </section>

      <AmountOwed
        report={payouts}
        period={period}
        onPeriod={setPeriod}
        custom={custom}
        onCustom={setCustom}
        customError={customError}
      />
    </div>
  );
}
