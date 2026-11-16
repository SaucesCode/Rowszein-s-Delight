import Switch from "@/components/ui/Switch";
import type { DraftDay } from "./draft";
import FieldMessage from "./FieldMessage";
import WeekHoursRows from "./WeekHoursRows";
import type { FieldErrors } from "./fieldErrors";

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
      <WeekHoursRows hours={hours} onHours={onHours} fields={fields} prefix="hours" owner="Delivery hours" />
    </div>
  );
}
