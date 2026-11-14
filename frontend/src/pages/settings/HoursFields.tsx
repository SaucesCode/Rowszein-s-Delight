import Switch from "@/components/ui/Switch";
import type { DraftDay } from "./draft";
import FieldMessage from "./FieldMessage";
import { invalidProps, type FieldErrors } from "./fieldErrors";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function HoursFields({
  hours,
  showHours,
  onHours,
  onShowHours,
  fields,
}: {
  hours: DraftDay[];
  showHours: boolean;
  onHours: (hours: DraftDay[]) => void;
  onShowHours: (show: boolean) => void;
  fields: FieldErrors;
}) {
  const update = (weekday: number, change: Partial<DraftDay>) =>
    onHours(hours.map(day => (day.weekday === weekday ? { ...day, ...change } : day)));
  const monday = hours.find(day => day.weekday === 0);
  const copyMonday = () =>
    monday && onHours(hours.map(day => (day.is_open ? { ...day, opens: monday.opens, closes: monday.closes } : day)));

  return (
    <div className="settings-card">
      <div className="settings-row shop-settings-switch">
        <Switch checked={showHours} onChange={onShowHours} describedBy={fields.fid("show_hours-hint")}>
          Show delivery hours in the shop
        </Switch>
        <p id={fields.fid("show_hours-hint")} className="field-hint">
          {showHours ? "Customers see these hours." : "Hidden from customers until you switch this on."}
        </p>
        <FieldMessage fields={fields} name="hours" />
      </div>
      <ul className="hours-list" aria-label="Delivery hours by day">
        {hours.map(day => {
          const name = DAY_NAMES[day.weekday];
          const opens = `hours.${day.weekday}.opens`;
          const closes = `hours.${day.weekday}.closes`;
          return (
            <li key={day.weekday} className="hours-row">
              <span className="hours-day" id={fields.fid(`day-${day.weekday}`)}>{name}</span>
              <Switch checked={day.is_open} onChange={is_open => update(day.weekday, { is_open })}>
                <span className="sr-only">{name} </span>{day.is_open ? "Open" : "Closed"}
              </Switch>
              {day.is_open && (
                <div className="hours-times">
                  <input
                    type="time"
                    className="field-input"
                    aria-label={`${name} opens`}
                    value={day.opens}
                    onChange={event => update(day.weekday, { opens: event.target.value })}
                    {...invalidProps(fields, opens)}
                  />
                  <span aria-hidden="true">to</span>
                  <input
                    type="time"
                    className="field-input"
                    aria-label={`${name} closes`}
                    value={day.closes}
                    onChange={event => update(day.weekday, { closes: event.target.value })}
                    {...invalidProps(fields, closes)}
                  />
                </div>
              )}
              <div className="hours-messages">
                <FieldMessage fields={fields} name={opens} />
                <FieldMessage fields={fields} name={closes} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="settings-row">
        <button type="button" className="link-button" onClick={copyMonday} disabled={!monday?.is_open}>
          Copy Monday's hours to the other open days
        </button>
      </div>
    </div>
  );
}
