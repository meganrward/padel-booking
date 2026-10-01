import type { AlertType, Preferences } from "../lib/preferences";
import { isEligibleForAdvancedTraining } from "../lib/preferences.utils";
import { TYPE_LABELS } from "../constants";
import { Chip, Field } from "./ui";

type TypeFields = Pick<Preferences, "types" | "level" | "gender" | "matches_start_time" | "matches_end_time">;

interface Props {
  value: TypeFields;
  onChange: (patch: Partial<Preferences>) => void;
}

export function AlertTypeFields({ value, onChange }: Props) {
  function toggleType(type: AlertType) {
    const types = value.types.includes(type)
      ? value.types.filter((t) => t !== type)
      : [...value.types, type];
    onChange({ types });
  }

  const showLevel =
    value.types.includes("train_and_play") ||
    value.types.includes("matches") ||
    value.types.includes("advanced_training");
  const showMatchTimes = value.types.includes("matches");

  const eligibleForAdvancedTraining = isEligibleForAdvancedTraining(value.gender, value.level);
  const visibleTypeLabels = TYPE_LABELS.filter(
    ({ key }) => key !== "advanced_training" || eligibleForAdvancedTraining || value.types.includes("advanced_training"),
  );

  return (
    <>
      <div className="chip-row" role="group" aria-label="Alert types">
        {visibleTypeLabels.map(({ key, label }) => (
          <Chip key={key} label={label} checked={value.types.includes(key)} onChange={() => toggleType(key)} />
        ))}
      </div>
      {showLevel && (
        <div className="field-row">
          <Field label="Level">
            <input
              className="input"
              type="number"
              step="0.25"
              min="0"
              placeholder="e.g. 4.25"
              value={value.level ?? ""}
              onChange={(e) => onChange({ level: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
        </div>
      )}
      {showMatchTimes && (
        <div className="field">
          <div className="field-row">
            <Field label="Match time from">
              <input
                className="input"
                type="time"
                aria-describedby="match-time-hint"
                value={value.matches_start_time ?? ""}
                onChange={(e) => onChange({ matches_start_time: e.target.value || null })}
              />
            </Field>
            <Field label="Match time to">
              <input
                className="input"
                type="time"
                aria-describedby="match-time-hint"
                value={value.matches_end_time ?? ""}
                onChange={(e) => onChange({ matches_end_time: e.target.value || null })}
              />
            </Field>
          </div>
          <span className="field-hint" id="match-time-hint">
            Only filters open match alerts
          </span>
        </div>
      )}
    </>
  );
}
