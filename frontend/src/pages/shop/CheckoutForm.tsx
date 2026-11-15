import type { ReactNode } from "react";
import { allowedDeliveryDates, deliveryDayLabel, type CheckoutField, type CheckoutForm as Form } from "@/lib/orderCheckout";
import { PAYMENT_LABELS, cutoffSentence, feeLabel } from "@/lib/shopSettings";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { PublicShopSettings } from "@/types/shopSettings.types";

export const PRIVACY_NOTICE =
  "We use your name, number and address only to confirm and deliver this order. We clear them 90 days after delivery.";

interface CheckoutFormProps {
  ids: string;
  form: Form;
  errors: Partial<Record<CheckoutField, string>>;
  settings: PublicShopSettings;
  now: Date;
  subtotal: number;
  onChange: (field: CheckoutField, value: string) => void;
}

/** Delivery details: who, where, when and how they'd like to pay. Every message sits next to its field. */
export default function CheckoutForm({ ids, form, errors, settings, now, subtotal, onChange }: CheckoutFormProps) {
  const fid = (field: CheckoutField) => `${ids}-${field}`;
  const describedBy = (field: CheckoutField, hint?: boolean) =>
    [errors[field] ? `${fid(field)}-error` : null, hint ? `${fid(field)}-hint` : null].filter(Boolean).join(" ") || undefined;
  const control = (field: CheckoutField, hint?: boolean) => ({
    id: fid(field),
    name: field,
    value: form[field],
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": describedBy(field, hint),
  });
  const message = (field: CheckoutField) =>
    errors[field] ? <p id={`${fid(field)}-error`} className="field-error">{errors[field]}</p> : null;

  const days = allowedDeliveryDates(settings, now);
  const town = settings.towns.find(option => String(option.id) === form.town);
  const fee = town?.fee ?? null;

  return (
    <div className="checkout-fields">
      <Field label="Your name" htmlFor={fid("customer_name")}>
        <input {...control("customer_name")} className="field-input" autoComplete="name" maxLength={80}
          onChange={event => onChange("customer_name", event.target.value)} />
        {message("customer_name")}
      </Field>

      <Field label="Mobile number" htmlFor={fid("phone")}>
        <input {...control("phone", true)} className="field-input" type="tel" inputMode="tel" autoComplete="tel"
          maxLength={20} placeholder="0917 123 4567" onChange={event => onChange("phone", event.target.value)} />
        <p id={`${fid("phone")}-hint`} className="field-hint">We'll text or call this number to confirm.</p>
        {message("phone")}
      </Field>

      <Field label="Town" htmlFor={fid("town")}>
        <select {...control("town")} className="field-input" onChange={event => onChange("town", event.target.value)}>
          <option value="">Choose your town</option>
          {settings.towns.map(option => (
            <option key={option.id} value={option.id}>{option.name} ({feeLabel(option.fee).toLowerCase()})</option>
          ))}
        </select>
        {message("town")}
      </Field>

      <Field label="Address and landmark" htmlFor={fid("address")}>
        <textarea {...control("address")} className="field-input" rows={2} maxLength={200} autoComplete="street-address"
          placeholder="House number, street, barangay, and a landmark"
          onChange={event => onChange("address", event.target.value)} />
        {message("address")}
      </Field>

      <Field label="Delivery day" htmlFor={fid("delivery_date")}>
        <select {...control("delivery_date", true)} className="field-input"
          onChange={event => onChange("delivery_date", event.target.value)}>
          <option value="">Choose a day</option>
          {days.map(day => <option key={day} value={day}>{deliveryDayLabel(day)}</option>)}
        </select>
        <p id={`${fid("delivery_date")}-hint`} className="field-hint">
          {cutoffSentence(settings.lead_days, settings.order_cutoff)}
        </p>
        {message("delivery_date")}
      </Field>

      {settings.payment_methods.length > 0 && (
        <fieldset className="checkout-payment" aria-describedby={errors.payment_method ? `${fid("payment_method")}-error` : undefined}>
          <legend className="field-label">How you'd like to pay</legend>
          <div className="checkout-payment-options">
            {settings.payment_methods.map((method, index) => (
              <label key={method} className="checkout-payment-option">
                <input
                  type="radio"
                  name={`${ids}-payment`}
                  id={index === 0 ? fid("payment_method") : undefined}
                  value={method}
                  checked={form.payment_method === method}
                  aria-invalid={index === 0 && errors.payment_method ? true : undefined}
                  onChange={() => onChange("payment_method", method)}
                />
                <span>{PAYMENT_LABELS[method]}</span>
              </label>
            ))}
          </div>
          {message("payment_method")}
        </fieldset>
      )}

      <Field label="Note for us (optional)" htmlFor={fid("note")}>
        <textarea {...control("note")} className="field-input" rows={2} maxLength={300}
          placeholder="Gate code, a birthday message, anything we should know"
          onChange={event => onChange("note", event.target.value)} />
        {message("note")}
      </Field>

      <dl className="checkout-totals">
        <div><dt>Your order</dt><dd className="num">{formatPeso(subtotal)}</dd></div>
        <div>
          <dt>Delivery</dt>
          <dd>{town ? (fee === null ? "Confirmed when we reply" : Number(fee) === 0 ? "Free" : formatPeso(Number(fee))) : "Choose your town"}</dd>
        </div>
        <div className="checkout-total">
          <dt>Total</dt>
          <dd className="num">{formatPeso(subtotal + (fee === null ? 0 : Number(fee)))}{fee === null ? " + delivery" : ""}</dd>
        </div>
      </dl>

      <p className="checkout-privacy">{PRIVACY_NOTICE}</p>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="checkout-field">
      <label htmlFor={htmlFor} className="field-label">{label}</label>
      {children}
    </div>
  );
}
