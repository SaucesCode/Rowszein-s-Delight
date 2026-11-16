import Switch from "@/components/ui/Switch";
import type { DraftDay } from "./draft";
import FieldMessage from "./FieldMessage";
import { invalidProps, type FieldErrors } from "./fieldErrors";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Seven weekday rows (open or closed, one window) plus "Copy Monday's hours". Used for delivery hours and
 * for each meet-up place. `prefix` is the API key the rows' errors use ("hours" or "meetup_places.0.hours");
 * `owner` names whose hours these are, so every control's label is unique on the page.
 */
export default function WeekHoursRows({
  hours,
  onHours,
  fields,
  prefix,
  owner,
}: {
  hours: DraftDay[];
  onHours: (hours: DraftDay[]) => void;
  fields: FieldErrors;
  prefix: string;
  owner: string;
}) {
  const update = (weekday: number, change: Partial<DraftDay>) =>
    onHours(hours.map(day => (day.weekday === weekday ? { ...day, ...change } : day)));
  const monday = hours.find(day => day.weekday === 0);
  const copyMonday = () =>
    monday && onHours(hours.map(day => (day.is_open ? { ...day, opens: monday.opens, closes: monday.closes } : day)));

  return (
    <>
      <ul className="hours-list" aria-label={`${owner} by day`}>
        {hours.map(day => {
          const name = DAY_NAMES[day.weekday];
          const opens = `${prefix}.${day.weekday}.opens`;
          const closes = `${prefix}.${day.weekday}.closes`;
          return (
            <li key={day.weekday} className="hours-row">
              <span className="hours-day">{name}</span>
              <Switch checked={day.is_open} onChange={is_open => update(day.weekday, { is_open })}>
                <span className="sr-only">{owner}, {name}: </span>{day.is_open ? "Open" : "Closed"}
              </Switch>
              {day.is_open && (
                <div className="hours-times">
                  <input
                    type="time"
                    className="field-input"
                    aria-label={`${owner}, ${name} opens`}
                    value={day.opens}
                    onChange={event => update(day.weekday, { opens: event.target.value })}
                    {...invalidProps(fields, opens)}
                  />
                  <span aria-hidden="true">to</span>
                  <input
                    type="time"
                    className="field-input"
                    aria-label={`${owner}, ${name} closes`}
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
      <div className="settings-list-foot">
        <button type="button" className="link-button" onClick={copyMonday} disabled={!monday?.is_open}>
          Copy Monday's hours to the other open days
        </button>
      </div>
    </>
  );
}
