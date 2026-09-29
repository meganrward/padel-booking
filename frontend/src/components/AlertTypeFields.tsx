import type { AlertType, Preferences } from "../lib/preferences";
import { TYPE_LABELS } from "../constants";
import { Chip, Field } from "./ui";

type TypeFields = Pick<Preferences, "types" | "level" | "matches_start_time" | "matches_end_time">;

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

  const showLevel = value.types.includes("train_and_play") || value.types.includes("matches");
  const showMatchTimes = value.types.includes("matches");

  return (
    <>
      <div className="chip-row" role="group" aria-label="Alert types">
        {TYPE_LABELS.map(({ key, label }) => (
          <Chip key={key} label={label} checked={value.types.includes(key)} onChange={() => toggleType(key)} />
        ))}
      </div>
      {(showLevel || showMatchTimes) && (
        <div className="field-row">
          {showLevel && (
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
          )}
          {showMatchTimes && (
            <Field label="Match time from" hint="Only filters open match alerts">
              <input
                className="input"
                type="time"
                value={value.matches_start_time ?? ""}
                onChange={(e) => onChange({ matches_start_time: e.target.value || null })}
              />
            </Field>
          )}
          {showMatchTimes && (
            <Field label="Match time to" hint="Only filters open match alerts">
              <input
                className="input"
                type="time"
                value={value.matches_end_time ?? ""}
                onChange={(e) => onChange({ matches_end_time: e.target.value || null })}
              />
            </Field>
          )}
        </div>
      )}
    </>
  );
}
