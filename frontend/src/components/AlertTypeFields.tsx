import type { AlertType, Person } from "../api";
import { TYPE_LABELS } from "../constants";

type TypeFields = Pick<Person, "types" | "level" | "matches_start_time" | "matches_end_time">;

interface Props {
  value: TypeFields;
  onChange: (patch: Partial<Person>) => void;
}

export function AlertTypeFields({ value, onChange }: Props) {
  function toggleType(type: AlertType) {
    const types = value.types.includes(type)
      ? value.types.filter((t) => t !== type)
      : [...value.types, type];
    onChange({ types });
  }

  return (
    <div className="toggles">
      {TYPE_LABELS.map(({ key, label }) => (
        <label key={key} className="toggle">
          <input type="checkbox" checked={value.types.includes(key)} onChange={() => toggleType(key)} />
          {label}
        </label>
      ))}
      {(value.types.includes("train_and_play") || value.types.includes("matches")) && (
        <label className="toggle level-input">
          Level
          <input
            type="number"
            step="0.25"
            min="0"
            placeholder="e.g. 4.25"
            value={value.level ?? ""}
            onChange={(e) => onChange({ level: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      )}
      {value.types.includes("matches") && (
        <label className="toggle level-input" title="Only filters open match alerts">
          Match time from
          <input
            type="time"
            value={value.matches_start_time ?? ""}
            onChange={(e) => onChange({ matches_start_time: e.target.value || null })}
          />
        </label>
      )}
      {value.types.includes("matches") && (
        <label className="toggle level-input" title="Only filters open match alerts">
          Match time to
          <input
            type="time"
            value={value.matches_end_time ?? ""}
            onChange={(e) => onChange({ matches_end_time: e.target.value || null })}
          />
        </label>
      )}
    </div>
  );
}
