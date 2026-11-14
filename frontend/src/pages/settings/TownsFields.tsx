import { Plus, Trash2 } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { rowKey, type DraftTown } from "./draft";
import FieldMessage from "./FieldMessage";
import { invalidProps, type FieldErrors } from "./fieldErrors";

const MAX_TOWNS = 20;

export default function TownsFields({
  towns,
  onTowns,
  fields,
}: {
  towns: DraftTown[];
  onTowns: (towns: DraftTown[]) => void;
  fields: FieldErrors;
}) {
  const update = (key: string, change: Partial<DraftTown>) =>
    onTowns(towns.map(town => (town.key === key ? { ...town, ...change } : town)));

  return (
    <div className="settings-card">
      <FieldMessage fields={fields} name="towns" />
      <ul className="settings-list" aria-label="Delivery towns">
        {towns.map((town, index) => {
          const label = town.name.trim() || "this town";
          return (
            <li key={town.key} className="settings-list-row town-row">
              <div className="town-name">
                <input
                  className="field-input"
                  aria-label="Town name"
                  maxLength={60}
                  value={town.name}
                  onChange={event => update(town.key, { name: event.target.value })}
                  {...invalidProps(fields, `towns.${index}.name`)}
                />
                <FieldMessage fields={fields} name={`towns.${index}.name`} />
                <FieldMessage fields={fields} name={`towns.${index}.id`} />
              </div>
              <div className="town-fee">
                <div className="settings-unit-input is-prefix">
                  <span aria-hidden="true">₱</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1000"
                    step="0.01"
                    placeholder="Not decided"
                    className="field-input num"
                    aria-label={`Delivery fee for ${label}`}
                    value={town.fee}
                    onChange={event => update(town.key, { fee: event.target.value })}
                    {...invalidProps(fields, `towns.${index}.fee`)}
                  />
                </div>
                <FieldMessage fields={fields} name={`towns.${index}.fee`} />
              </div>
              <Switch checked={town.is_active} onChange={is_active => update(town.key, { is_active })}>
                <span className="sr-only">{label}: </span>{town.is_active ? "Delivering" : "Paused"}
              </Switch>
              <button
                type="button"
                className="settings-remove"
                aria-label={`Remove ${label}`}
                onClick={() => onTowns(towns.filter(row => row.key !== town.key))}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="settings-row">
        <p className="field-hint">Leave the fee blank until you decide; customers see "Fee confirmed when we reply". 0 means free delivery.</p>
        <button
          type="button"
          className="link-button settings-add"
          disabled={towns.length >= MAX_TOWNS}
          onClick={() => onTowns([...towns, { key: rowKey(), name: "", is_active: true, fee: "" }])}
        >
          <Plus size={16} aria-hidden="true" /> Add town
        </button>
      </div>
    </div>
  );
}
