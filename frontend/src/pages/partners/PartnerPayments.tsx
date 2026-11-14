import { useId, useState, type FormEvent } from "react";
import { usePartnerPayments, useRecordPayment, useVoidPayment } from "@/hooks/usePartners";
import { apiFieldErrors } from "@/lib/csrfTransport";
import { formatBusinessDate, manilaDate } from "@/lib/dateRanges";
import { formatPeso } from "@/pages/dashboard/report-format";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import type { PartnerPayment } from "@/types/partner.types";

const PAGE_SIZE = 20;

function RecordPayment({ partnerId, partnerName }: { partnerId: number; partnerName: string }) {
  const id = useId();
  const record = useRecordPayment();
  const [date, setDate] = useState(manilaDate());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ date?: string; amount?: string; note?: string }>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) found.amount = "Enter an amount above ₱0.";
    if (!date) found.date = "Choose the date you paid.";
    else if (date > manilaDate()) found.date = "The payment date can't be in the future.";
    setErrors(found);
    if (found.amount || found.date) return;
    record.mutate(
      { partnerId, payload: { date, amount: value.toFixed(2), note: note.trim() } },
      {
        onSuccess: () => { setAmount(""); setNote(""); },
        onError: error => setErrors(apiFieldErrors(error) ?? {}),
      },
    );
  };

  return (
    <form className="payment-form" onSubmit={submit} noValidate aria-label={`Record a payment to ${partnerName}`}>
      <div>
        <label htmlFor={`${id}-amount`} className="field-label">Amount paid</label>
        <div className="settings-unit-input is-prefix">
          <span aria-hidden="true">₱</span>
          <input id={`${id}-amount`} type="number" inputMode="decimal" min="0.01" step="0.01" className="field-input num"
            value={amount} onChange={event => setAmount(event.target.value)}
            aria-invalid={!!errors.amount} aria-describedby={errors.amount ? `${id}-amount-error` : undefined} />
        </div>
        {errors.amount && <p id={`${id}-amount-error`} className="field-error">{errors.amount}</p>}
      </div>
      <div>
        <label htmlFor={`${id}-date`} className="field-label">Paid on</label>
        <input id={`${id}-date`} type="date" className="field-input" max={manilaDate()} value={date}
          onChange={event => setDate(event.target.value)}
          aria-invalid={!!errors.date} aria-describedby={errors.date ? `${id}-date-error` : undefined} />
        {errors.date && <p id={`${id}-date-error`} className="field-error">{errors.date}</p>}
      </div>
      <div className="payment-form-note">
        <label htmlFor={`${id}-note`} className="field-label">Note <span className="field-optional">(optional)</span></label>
        <input id={`${id}-note`} className="field-input" maxLength={200} placeholder="GCash ref, cash, bank transfer"
          value={note} onChange={event => setNote(event.target.value)}
          aria-invalid={!!errors.note} aria-describedby={errors.note ? `${id}-note-error` : undefined} />
        {errors.note && <p id={`${id}-note-error`} className="field-error">{errors.note}</p>}
      </div>
      <button type="submit" className="btn-primary payment-form-button" disabled={record.isPending} aria-busy={record.isPending}>
        {record.isPending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}

function VoidPayment({ partnerId, payment }: { partnerId: number; payment: PartnerPayment }) {
  const id = useId();
  const voidPayment = useVoidPayment();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (!reason.trim()) return setError("Say why this payment is being voided.");
    setError(null);
    voidPayment.mutate(
      { partnerId, paymentId: payment.id, reason: reason.trim() },
      { onSuccess: () => { setOpen(false); setReason(""); } },
    );
  };

  return (
    <>
      <button type="button" className="btn-ghost payment-void" onClick={() => setOpen(true)}>
        Void<span className="sr-only"> the {formatPeso(Number(payment.amount))} payment of {formatBusinessDate(payment.date)}</span>
      </button>
      <ConfirmDialog
        open={open}
        title={`Void the ${formatPeso(Number(payment.amount))} payment?`}
        description="It stays in the list, crossed out, and no longer counts toward what you've paid."
        confirmLabel="Void payment"
        cancelLabel="Keep it"
        destructive
        loading={voidPayment.isPending}
        onConfirm={confirm}
        onCancel={() => { setOpen(false); setError(null); }}
      >
        <label htmlFor={`${id}-reason`} className="field-label">Why are you voiding it?</label>
        <input id={`${id}-reason`} className="field-input" maxLength={200} value={reason}
          onChange={event => setReason(event.target.value)}
          aria-invalid={!!error} aria-describedby={error ? `${id}-reason-error` : undefined} />
        {error && <p id={`${id}-reason-error`} className="field-error">{error}</p>}
      </ConfirmDialog>
    </>
  );
}

export default function PartnerPayments({ partnerId, partnerName }: { partnerId: number; partnerName: string }) {
  const [page, setPage] = useState(1);
  const payments = usePartnerPayments(partnerId, page);
  const totalPages = Math.max(1, Math.ceil((payments.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="partner-payments">
      <RecordPayment partnerId={partnerId} partnerName={partnerName} />
      <h4 className="partner-payments-title">Payments</h4>
      {payments.isPending && <span className="skeleton block h-12 w-full" aria-hidden="true" />}
      {payments.isError && (
        <div className="box-state" role="alert">
          <p>Couldn't load the payments.</p>
          <button type="button" className="btn-secondary" onClick={() => void payments.refetch()}>Try again</button>
        </div>
      )}
      {payments.isSuccess && payments.data.results.length === 0 && (
        <p className="partner-quiet">No payments recorded yet.</p>
      )}
      {payments.isSuccess && payments.data.results.length > 0 && (
        <ul className="payment-list">
          {payments.data.results.map(payment => (
            <li key={payment.id} className={payment.voided_at ? "is-voided" : undefined}>
              <span className="payment-main">
                <span className="payment-amount num">{formatPeso(Number(payment.amount))}</span>
                <span className="payment-meta">
                  {formatBusinessDate(payment.date)}{payment.note ? ` · ${payment.note}` : ""}
                </span>
                {payment.voided_at && <span className="payment-voided">Voided: {payment.void_reason}</span>}
              </span>
              {!payment.voided_at && <VoidPayment partnerId={partnerId} payment={payment} />}
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}
