import type { Person } from "../api";
import { AlertTypeFields } from "./AlertTypeFields";

interface Props {
  value: Person;
  onChange: (next: Person) => void;
  onSubmit: (e: React.FormEvent) => void;
  canSubmit: boolean;
}

export function AddPersonForm({ value, onChange, onSubmit, canSubmit }: Props) {
  return (
    <form className="add-form" onSubmit={onSubmit}>
      <h2>Add person</h2>
      <input
        placeholder="Name"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <input
        placeholder="Email or +phone"
        value={value.target}
        onChange={(e) => onChange({ ...value, target: e.target.value })}
      />
      <AlertTypeFields value={value} onChange={(patch) => onChange({ ...value, ...patch })} />
      <button type="submit" disabled={!canSubmit}>
        Add person
      </button>
    </form>
  );
}
