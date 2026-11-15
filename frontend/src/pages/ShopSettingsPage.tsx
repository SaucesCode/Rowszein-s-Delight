import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import Row from "@/components/ui/SettingsRow";
import Switch from "@/components/ui/Switch";
import { useManagedShopSettings, useSaveShopSettings } from "@/hooks/useShopSettings";
import { apiErrorMessage, apiFieldErrors } from "@/lib/csrfTransport";
import { manilaDate } from "@/lib/dateRanges";
import { DEFAULT_PAUSE_MESSAGE, PAYMENT_LABELS, cutoffSentence } from "@/lib/shopSettings";
import type { ManagedShopSettings, PaymentMethod } from "@/types/shopSettings.types";
import DaysOffFields from "./settings/DaysOffFields";
import FieldMessage from "./settings/FieldMessage";
import HoursFields from "./settings/HoursFields";
import TownsFields from "./settings/TownsFields";
import { isDirty, toDraft, toPayload, type Draft } from "./settings/draft";
import { invalidProps, type FieldErrors } from "./settings/fieldErrors";
import "./settings/settings.css";

const LEAD_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7];
const leadLabel = (days: number) => (days === 0 ? "Same day" : days === 1 ? "1 day ahead" : `${days} days ahead`);

function ShopSettingsForm({ settings }: { settings: ManagedShopSettings }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const save = useSaveShopSettings();
  const [saved, setSaved] = useState(() => toDraft(settings));
  const [draft, setDraft] = useState(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<ManagedShopSettings | null>(null);
  const today = manilaDate();

  const fields: FieldErrors = {
    error: key => errors[key],
    fid: key => `${id}-${key.replace(/[^a-z0-9_-]/gi, "-")}`,
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const before = draft[key];
    if (Array.isArray(value) && Array.isArray(before) && value.length !== before.length) {
      setErrors(current => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key && !name.startsWith(`${key}.`))));
    }
    setDraft(current => ({ ...current, [key]: value }));
  };
  const conflictRef = useRef<HTMLDivElement>(null);

  const dirty = isDirty(draft, saved);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !save.isPending && currentLocation.pathname !== nextLocation.pathname,
  );

  // A refused save because of a newer version: bring the owner to the explanation, wherever they pressed Save.
  useEffect(() => {
    if (conflict) conflictRef.current?.focus();
  }, [conflict]);

  // After a refused save, take the owner to the first field that needs fixing.
  useEffect(() => {
    if (Object.keys(errors).length) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const adopt = (doc: ManagedShopSettings) => {
    const next = toDraft(doc);
    setSaved(next);
    setDraft(next);
    setErrors({});
    setConflict(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(toPayload(draft), {
      onSuccess: doc => {
        adopt(doc);
        toast.success("Shop settings saved.");
      },
      onError: error => {
        if (isAxiosError(error) && error.response?.status === 409) {
          setConflict(error.response.data?.data ?? null);
          toast.error("Not saved: these settings were changed somewhere else.");
          return;
        }
        const found = apiFieldErrors(error);
        if (found) setErrors(found);
        else toast.error(apiErrorMessage(error, "Couldn't save the settings. Check the internet connection, then try again."));
      },
    });
  };

  const togglePayment = (method: PaymentMethod, on: boolean) =>
    set("payment_methods", (Object.keys(PAYMENT_LABELS) as PaymentMethod[]).filter(m => (m === method ? on : draft.payment_methods.includes(m))));

  return (
    <>
      <form ref={formRef} className="settings-form shop-settings" onSubmit={onSubmit} noValidate>
        <header className="page-head">
          <div>
            <h1 className="type-page">Shop settings</h1>
            <p className="page-lede">What customers see about delivery, ordering and how to reach you. Customers see changes the next time they open the shop.</p>
          </div>
        </header>

        {conflict && (
          <div ref={conflictRef} tabIndex={-1} role="alert" className="settings-conflict">
            <p>These settings were changed in another tab or by someone else. Your edits are still here, but saving them would undo those changes.</p>
            <button type="button" className="btn-secondary" onClick={() => adopt(conflict)}>Reload their version</button>
          </div>
        )}

        <section className="settings-group" aria-labelledby={fields.fid("hours-title")}>
          <h2 id={fields.fid("hours-title")} className="settings-group-title">Delivery hours</h2>
          <HoursFields
            hours={draft.hours}
            showHours={draft.show_hours}
            onHours={hours => set("hours", hours)}
            onShowHours={show => set("show_hours", show)}
            fields={fields}
          />
        </section>

        <section className="settings-group" aria-labelledby={fields.fid("days-title")}>
          <h2 id={fields.fid("days-title")} className="settings-group-title">Days off</h2>
          <DaysOffFields days={draft.days_off} today={today} onDays={days => set("days_off", days)} fields={fields} />
        </section>

        <section className="settings-group" aria-labelledby={fields.fid("towns-title")}>
          <h2 id={fields.fid("towns-title")} className="settings-group-title">Delivery towns</h2>
          <TownsFields towns={draft.towns} onTowns={towns => set("towns", towns)} fields={fields} />
        </section>

        <section className="settings-group" aria-labelledby={fields.fid("ordering-title")}>
          <h2 id={fields.fid("ordering-title")} className="settings-group-title">Ordering</h2>
          <div className="settings-card">
            <Row label="Order ahead" htmlFor={fields.fid("lead_days")} error={errors.lead_days}>
              <select
                className="field-input settings-date"
                value={draft.lead_days}
                onChange={event => set("lead_days", Number(event.target.value))}
                {...invalidProps(fields, "lead_days")}
              >
                {LEAD_CHOICES.map(days => <option key={days} value={days}>{leadLabel(days)}</option>)}
              </select>
            </Row>
            <Row
              label="Order by"
              htmlFor={fields.fid("order_cutoff")}
              error={errors.order_cutoff}
              hint={<>Optional. Customers read: <q>{cutoffSentence(draft.lead_days, draft.order_cutoff || null)}</q></>}
            >
              <input
                type="time"
                className="field-input settings-date"
                value={draft.order_cutoff}
                onChange={event => set("order_cutoff", event.target.value)}
                {...invalidProps(fields, "order_cutoff")}
              />
            </Row>
            <Row label="Pause orders">
              <div className="settings-switch-row">
                <Switch checked={draft.orders_paused} onChange={on => set("orders_paused", on)} describedBy={fields.fid("pause-hint")}>
                  Pause online orders
                </Switch>
                <p id={fields.fid("pause-hint")} className="field-hint">
                  {draft.orders_paused ? "Customers can browse but can't send orders." : "Customers can send orders."}
                </p>
              </div>
            </Row>
            <Row label="Message while paused" htmlFor={fields.fid("pause_message")} error={errors.pause_message} hint={`${draft.pause_message.length}/160`}>
              <textarea
                className="field-input"
                rows={2}
                maxLength={160}
                placeholder={DEFAULT_PAUSE_MESSAGE}
                value={draft.pause_message}
                onChange={event => set("pause_message", event.target.value)}
                {...invalidProps(fields, "pause_message")}
              />
            </Row>
            <Row
              label="Notice bar"
              htmlFor={fields.fid("notice")}
              error={errors.notice}
              hint={`Optional, shown at the top of the shop. ${draft.notice.length}/160`}
            >
              <input
                className="field-input"
                maxLength={160}
                placeholder="No deliveries on Nov 30"
                value={draft.notice}
                onChange={event => set("notice", event.target.value)}
                {...invalidProps(fields, "notice")}
              />
            </Row>
          </div>
        </section>

        <section className="settings-group" aria-labelledby={fields.fid("pay-title")}>
          <h2 id={fields.fid("pay-title")} className="settings-group-title">Payment methods</h2>
          <div className="settings-card settings-card-padded">
            <fieldset className="payment-options" aria-describedby={errors.payment_methods ? `${fields.fid("payment_methods")}-msg` : undefined}>
              <legend className="sr-only">Payment methods customers can use</legend>
              {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([method, label], index) => (
                <label key={method} className="payment-option">
                  <input
                    type="checkbox"
                    checked={draft.payment_methods.includes(method)}
                    onChange={event => togglePayment(method, event.target.checked)}
                    aria-invalid={index === 0 && errors.payment_methods ? true : undefined}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <FieldMessage fields={fields} name="payment_methods" />
          </div>
        </section>

        <section className="settings-group" aria-labelledby={fields.fid("contact-title")}>
          <h2 id={fields.fid("contact-title")} className="settings-group-title">Contact</h2>
          <div className="settings-card">
            <Row label="Messenger link" htmlFor={fields.fid("messenger_url")} error={errors.messenger_url} hint="Required. Every order is sent here.">
              <input
                type="url"
                required
                className="field-input"
                placeholder="https://m.me/rowszeinsdelight"
                value={draft.messenger_url}
                onChange={event => set("messenger_url", event.target.value)}
                {...invalidProps(fields, "messenger_url")}
              />
            </Row>
            <Row label="Facebook page" htmlFor={fields.fid("facebook_url")} error={errors.facebook_url} hint="Optional. Leave blank to hide it.">
              <input
                type="url"
                className="field-input"
                placeholder="https://www.facebook.com/rowszeinsdelight"
                value={draft.facebook_url}
                onChange={event => set("facebook_url", event.target.value)}
                {...invalidProps(fields, "facebook_url")}
              />
            </Row>
            <Row label="Email" htmlFor={fields.fid("email")} error={errors.email} hint="Optional. Leave blank to hide it.">
              <input
                type="email"
                className="field-input"
                value={draft.email}
                onChange={event => set("email", event.target.value)}
                {...invalidProps(fields, "email")}
              />
            </Row>
            <Row
              label="New-order emails go to"
              htmlFor={fields.fid("order_email")}
              error={errors.order_email}
              hint="Only you see this. Every order sent from the shop is emailed here."
            >
              <input
                type="email"
                className="field-input"
                autoComplete="email"
                value={draft.order_email}
                onChange={event => set("order_email", event.target.value)}
                {...invalidProps(fields, "order_email")}
              />
            </Row>
            <Row label="Phone" htmlFor={fields.fid("phone")} error={errors.phone} hint="Optional. Leave blank to hide it.">
              <input
                type="tel"
                className="field-input"
                placeholder="0917 123 4567"
                value={draft.phone}
                onChange={event => set("phone", event.target.value)}
                {...invalidProps(fields, "phone")}
              />
            </Row>
          </div>
        </section>

        <footer className="settings-actions">
          <button type="button" className="btn-ghost" disabled={!dirty || save.isPending} onClick={() => {
              setDraft(saved);
              setErrors({});
            }}
          >
            Undo changes
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending || !dirty} aria-busy={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </button>
        </footer>
      </form>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description="Your changes to the shop settings haven't been saved yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}

export default function ShopSettingsPage() {
  const navigate = useNavigate();
  const query = useManagedShopSettings();
  if (query.isPending) {
    return (
      <div className="settings-form" aria-busy="true">
        <span className="skeleton block h-10 w-64" />
        <span className="skeleton mt-8 block h-64 w-full" aria-hidden="true" />
        <span className="skeleton mt-6 block h-48 w-full" aria-hidden="true" />
        <span className="sr-only" role="status">Loading the shop settings</span>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <RecordLoadError name="shop settings page" invalidId={false} error={query.error} retry={() => void query.refetch()} back={() => navigate("/home")} />
    );
  }
  return <ShopSettingsForm settings={query.data} />;
}
