import { useId } from "react";
import { Download } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { downloadCSV } from "@/lib/csv";
import { formatBusinessDate } from "@/lib/dateRanges";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { PartnerPayouts } from "@/types/partner.types";

export type OwedPeriod = "this_week" | "this_month" | "last_month" | "custom";

const PERIODS: { value: OwedPeriod; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

function exportOwed(report: PartnerPayouts) {
  const { date_from, date_to } = report.filters;
  const rows = report.partners.flatMap(partner =>
    partner.items.map(item => [partner.name, item.product_name, item.quantity, item.payout, item.owed]),
  );
  downloadCSV(`partners-owed-${date_from}-to-${date_to}.csv`, ["Partner", "Item", "Sold", "Their price", "Owed"], rows);
}

export default function AmountOwed({ report, period, onPeriod, custom, onCustom, customError }: {
  report: UseQueryResult<PartnerPayouts>;
  period: OwedPeriod;
  onPeriod: (period: OwedPeriod) => void;
  custom: { date_from: string; date_to: string };
  onCustom: (range: { date_from: string; date_to: string }) => void;
  customError?: string;
}) {
  const id = useId();
  const owed = report.data?.partners.filter(partner => partner.items.length > 0) ?? [];

  return (
    <section className="settings-group" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="settings-group-title">Amount owed</h2>
      <div className="owed-controls">
        <div className="segmented" role="group" aria-label="Dates">
          {PERIODS.map(option => (
            <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => onPeriod(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        {report.isSuccess && owed.length > 0 && (
          <button type="button" className="btn-secondary" onClick={() => exportOwed(report.data)}>
            <Download size={18} aria-hidden="true" />
            Download CSV
          </button>
        )}
      </div>
      {period === "custom" && (
        <div className="owed-custom">
          <div>
            <label htmlFor={`${id}-from`} className="field-label">From</label>
            <input id={`${id}-from`} type="date" className="field-input" value={custom.date_from}
              onChange={event => onCustom({ ...custom, date_from: event.target.value })}
              aria-invalid={!!customError} aria-describedby={customError ? `${id}-range-error` : undefined} />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="field-label">To</label>
            <input id={`${id}-to`} type="date" className="field-input" value={custom.date_to}
              onChange={event => onCustom({ ...custom, date_to: event.target.value })}
              aria-invalid={!!customError} aria-describedby={customError ? `${id}-range-error` : undefined} />
          </div>
          {customError && <p id={`${id}-range-error`} className="field-error owed-custom-error">{customError}</p>}
        </div>
      )}

      <div className="settings-card owed-card">
        {report.isPending && <span className="skeleton block h-24 w-full" aria-hidden="true" />}
        {report.isError && (
          <div className="box-state" role="alert">
            <p>Couldn't work out what's owed.</p>
            <button type="button" className="btn-secondary" onClick={() => void report.refetch()}>Try again</button>
          </div>
        )}
        {report.isSuccess && (
          <>
            <p className="owed-summary">
              <span>{formatBusinessDate(report.data.filters.date_from)} to {formatBusinessDate(report.data.filters.date_to)}</span>
              <strong className="num">{formatPeso(Number(report.data.total))}</strong>
            </p>
            {owed.length === 0 ? (
              <p className="partner-quiet">No partner items were sold in these dates.</p>
            ) : (
              owed.map(partner => (
                <div key={partner.id} className="owed-partner">
                  <h3 id={`${id}-partner-${partner.id}`} className="owed-partner-head">
                    <span>{partner.name}</span>
                    <span className="num">{formatPeso(Number(partner.owed))}</span>
                  </h3>
                  <div className="owed-table-scroll" tabIndex={0} role="region" aria-labelledby={`${id}-partner-${partner.id}`}>
                    <table className="owed-table" aria-labelledby={`${id}-partner-${partner.id}`}>
                      <thead>
                        <tr>
                          <th scope="col">Item</th>
                          <th scope="col">Sold</th>
                          <th scope="col">Their price</th>
                          <th scope="col">Owed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partner.items.map(item => (
                          <tr key={`${item.product}-${item.payout}`}>
                            <th scope="row">{item.product_name}</th>
                            <td className="num">{item.quantity}</td>
                            <td className="num">{formatPeso(Number(item.payout))}</td>
                            <td className="num">{formatPeso(Number(item.owed))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
      <p className="field-hint owed-note">
        Counted by order date. Cancelled orders aren't included. Don't also enter these as shop expenses; profit already subtracts them.
      </p>
    </section>
  );
}
