import { Plus, Trash2 } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { rowKey, type DraftDay, type DraftMeetupPlace } from "./draft";
import FieldMessage from "./FieldMessage";
import WeekHoursRows from "./WeekHoursRows";
import { invalidProps, type FieldErrors } from "./fieldErrors";

const MAX_PLACES = 10;
const NOTE_LIMIT = 160;

/** A new place starts open on Saturday afternoon only: a usable starting point to edit. */
function newPlace(): DraftMeetupPlace {
  const hours: DraftDay[] = Array.from({ length: 7 }, (_, weekday) =>
    weekday === 5 ? { weekday, is_open: true, opens: "14:00", closes: "17:00" } : { weekday, is_open: false, opens: "", closes: "" });
  return { key: rowKey(), name: "", note: "", is_active: true, hours };
}

export default function MeetupPlacesFields({
  places,
  onPlaces,
  fields,
}: {
  places: DraftMeetupPlace[];
  onPlaces: (places: DraftMeetupPlace[]) => void;
  fields: FieldErrors;
}) {
  const update = (key: string, change: Partial<DraftMeetupPlace>) =>
    onPlaces(places.map(place => (place.key === key ? { ...place, ...change } : place)));

  return (
    <div className="meetup-places">
      <FieldMessage fields={fields} name="meetup_places" />
      {places.length === 0 && (
        <p className="settings-empty meetup-empty">No meet-up places yet. Customers can only choose delivery.</p>
      )}
      {places.map((place, index) => {
        const label = place.name.trim() || `Meet-up place ${index + 1}`;
        const key = (field: string) => `meetup_places.${index}.${field}`;
        return (
          <section key={place.key} className="settings-card meetup-place" aria-label={label}>
            <div className="meetup-place-head">
              <label className="meetup-place-field">
                <span className="field-label">Place name</span>
                <input
                  className="field-input"
                  maxLength={80}
                  placeholder="SM City Lucena, main entrance"
                  value={place.name}
                  onChange={event => update(place.key, { name: event.target.value })}
                  {...invalidProps(fields, key("name"))}
                />
                <FieldMessage fields={fields} name={key("name")} />
                <FieldMessage fields={fields} name={key("id")} />
              </label>
              <button
                type="button"
                className="settings-remove"
                aria-label={`Remove ${label}`}
                onClick={() => onPlaces(places.filter(row => row.key !== place.key))}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <label className="meetup-place-field">
              <span className="field-label">Note for customers (optional)</span>
              <input
                className="field-input"
                maxLength={NOTE_LIMIT}
                placeholder="We'll be by the fountain. Look for the pink box."
                value={place.note}
                onChange={event => update(place.key, { note: event.target.value })}
                {...invalidProps(fields, key("note"))}
              />
              <span className="field-hint num">{place.note.length}/{NOTE_LIMIT}</span>
              <FieldMessage fields={fields} name={key("note")} />
            </label>
            <div className="meetup-place-switch">
              <Switch checked={place.is_active} onChange={is_active => update(place.key, { is_active })}>
                <span className="sr-only">{label}: </span>{place.is_active ? "Meeting here" : "Paused"}
              </Switch>
              <FieldMessage fields={fields} name={key("hours")} />
            </div>
            <WeekHoursRows
              hours={place.hours}
              onHours={hours => update(place.key, { hours })}
              fields={fields}
              prefix={key("hours")}
              owner={label}
            />
          </section>
        );
      })}
      <button
        type="button"
        className="link-button settings-add"
        disabled={places.length >= MAX_PLACES}
        onClick={() => onPlaces([...places, newPlace()])}
      >
        <Plus size={16} aria-hidden="true" /> Add meet-up place
      </button>
    </div>
  );
}
