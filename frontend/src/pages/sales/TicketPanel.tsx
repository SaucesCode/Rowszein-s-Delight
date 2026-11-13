import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import { formatPeso } from "@/pages/dashboard/report-format";
import { formatBusinessDate } from "@/lib/dateRanges";
import { lineTotal, type Ticket } from "./useTicket";

export interface Recorded {
  amount: number;
  pieces: number;
  at: Date;
}

interface TicketPanelProps {
  ticket: Ticket;
  title: string;
  canEditPrice: boolean;
  date: string;
  today: string;
  onDateChange?: (date: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  error: string | null;
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onClear: () => void;
  recorded?: Recorded | null;
}

const timeFormatter = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

/** The order being rung up, styled as a paper ticket. Record stays pinned at the bottom. */
export default function TicketPanel(props: TicketPanelProps) {
  const { ticket, canEditPrice, date, today, notes, error, saving } = props;
  const ids = useId();
  const [showNote, setShowNote] = useState(notes.length > 0);
  const [showDate, setShowDate] = useState(false);
  const empty = ticket.lines.length === 0;

  return (
    <div className="ticket">
      <header className="ticket-head">
        <h2 className="ticket-title">{props.title}</h2>
        {!empty && (
          <button type="button" className="btn-ghost ticket-clear" onClick={props.onClear}>
            Start over
          </button>
        )}
      </header>

      <div className="ticket-scroll">
        {empty ? (
          props.recorded ? (
            <div className="ticket-recorded" role="status">
              <CheckCircle2 size={28} aria-hidden="true" />
              <p className="ticket-recorded-title">
                Recorded {formatPeso(props.recorded.amount)} at {timeFormatter.format(props.recorded.at)}
              </p>
              <p>Ready for the next customer. Tap a donut to start.</p>
              <Link to="/sales" className="home-link">See today's sales</Link>
            </div>
          ) : (
            <p className="ticket-empty">Tap a donut to add it to this order.</p>
          )
        ) : (
          <ol className="ticket-lines" aria-label="Items in this order">
            {ticket.lines.map(line => (
              <li key={line.product} className="ticket-line">
                <div className="ticket-line-text">
                  <span className="ticket-line-name">{line.name}</span>
                  {canEditPrice ? (
                    <label className="ticket-line-price">
                      <span className="sr-only">Price each for {line.name}</span>
                      <span aria-hidden="true">₱</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        className="num"
                        value={line.unitPrice}
                        onChange={event => ticket.setPrice(line.product, Number(event.target.value))}
                      />
                      <span aria-hidden="true">each</span>
                    </label>
                  ) : (
                    <span className="ticket-line-each num">{formatPeso(line.unitPrice)} each</span>
                  )}
                </div>
                <div className="ticket-stepper" role="group" aria-label={`${line.name} quantity`}>
                  <button type="button" onClick={() => ticket.change(line.product, -1)} aria-label={`One less ${line.name}`}>
                    <Minus size={18} aria-hidden="true" />
                  </button>
                  <span className="num" aria-live="polite">{line.quantity}</span>
                  <button type="button" onClick={() => ticket.change(line.product, 1)} aria-label={`One more ${line.name}`}>
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>
                <span className="ticket-line-total num">{formatPeso(lineTotal(line))}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="ticket-extras">
          {props.onDateChange ? (
            showDate || date !== today ? (
              <div>
                <label htmlFor={`${ids}-date`} className="field-label">Sale date</label>
                <input
                  id={`${ids}-date`}
                  type="date"
                  className="field-input"
                  value={date}
                  max={today}
                  onChange={event => props.onDateChange?.(event.target.value)}
                />
              </div>
            ) : (
              <p className="ticket-date-note">
                Sale date: today
                <button type="button" className="link-button" onClick={() => setShowDate(true)}>
                  Change<span className="sr-only"> the sale date</span>
                </button>
              </p>
            )
          ) : (
            date !== today && <p className="ticket-date-note">Sale date: {formatBusinessDate(date)}</p>
          )}

          {showNote ? (
            <div>
              <label htmlFor={`${ids}-note`} className="field-label">Note</label>
              <textarea
                id={`${ids}-note`}
                className="field-input"
                rows={2}
                maxLength={500}
                placeholder="For example, birthday order for Ana"
                value={notes}
                onChange={event => props.onNotesChange(event.target.value)}
              />
            </div>
          ) : (
            <button type="button" className="link-button" onClick={() => setShowNote(true)}>
              Add a note
            </button>
          )}
        </div>
      </div>

      <footer className="ticket-foot">
        <p className="ticket-total">
          <span>{ticket.totals.pieces === 1 ? "1 donut" : `${ticket.totals.pieces} donuts`}</span>
          <strong className="num">{formatPeso(ticket.totals.amount)}</strong>
        </p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button
          type="button"
          className="btn-primary ticket-submit"
          onClick={props.onSubmit}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Saving…" : props.submitLabel}
        </button>
      </footer>
    </div>
  );
}
