import { Plus, Trash2 } from "lucide-react";
import { dayOffLabel } from "@/lib/shopSettings";
import { rowKey, type DraftDayOff } from "./draft";
import FieldMessage from "./FieldMessage";
import { invalidProps, type FieldErrors } from "./fieldErrors";

const MAX_DAYS_OFF = 30;

export default function DaysOffFields({
  days,
  today,
  onDays,
  fields,
}: {
  days: DraftDayOff[];
  today: string;
  onDays: (days: DraftDayOff[]) => void;
  fields: FieldErrors;
}) {
  const update = (key: string, change: Partial<DraftDayOff>) =>
    onDays(days.map(day => (day.key === key ? { ...day, ...change } : day)));

  return (
    <div className="settings-card">
      <FieldMessage fields={fields} name="days_off" />
      {days.length === 0 && <p className="settings-empty">No days off coming up. Deliveries follow your weekly hours.</p>}
      <ul className="settings-list" aria-label="Days off">
        {days.map((day, index) => {
          const label = day.starts && day.ends ? dayOffLabel({ ...day, note: "" }) : "these days off";
          return (
            <li key={day.key} className="settings-list-row day-off-row">
              <label className="day-off-field">
                <span className="field-label">From</span>
                <input
                  type="date"
                  className="field-input"
                  min={today}
                  value={day.starts}
                  onChange={event => update(day.key, { starts: event.target.value, ends: day.ends < event.target.value ? event.target.value : day.ends })}
                  {...invalidProps(fields, `days_off.${index}.starts`)}
                />
              </label>
              <label className="day-off-field">
                <span className="field-label">To</span>
                <input
                  type="date"
                  className="field-input"
                  min={day.starts || today}
                  value={day.ends}
                  onChange={event => update(day.key, { ends: event.target.value })}
                  {...invalidProps(fields, `days_off.${index}.ends`)}
                />
              </label>
              <label className="day-off-field day-off-note">
                <span className="field-label">Note for customers (optional)</span>
                <input
                  className="field-input"
                  maxLength={80}
                  placeholder="Christmas break"
                  value={day.note}
                  onChange={event => update(day.key, { note: event.target.value })}
                  {...invalidProps(fields, `days_off.${index}.note`)}
                />
              </label>
              <button
                type="button"
                className="settings-remove"
                aria-label={`Remove ${label}`}
                onClick={() => onDays(days.filter(row => row.key !== day.key))}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
              <div className="day-off-messages">
                <FieldMessage fields={fields} name={`days_off.${index}.starts`} />
                <FieldMessage fields={fields} name={`days_off.${index}.ends`} />
                <FieldMessage fields={fields} name={`days_off.${index}.note`} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="settings-list-foot">
        <button
          type="button"
          className="link-button settings-add"
          disabled={days.length >= MAX_DAYS_OFF}
          onClick={() => onDays([...days, { key: rowKey(), starts: today, ends: today, note: "" }])}
        >
          <Plus size={16} aria-hidden="true" /> Add days off
        </button>
      </div>
    </div>
  );
}
