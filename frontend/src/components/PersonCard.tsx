import type { Person } from "../api";
import { AlertTypeFields } from "./AlertTypeFields";
import { InstructorPicker } from "./InstructorPicker";

interface Props {
  person: Person;
  instructors: string[];
  onChange: (patch: Partial<Person>) => void;
  onDelete: () => void;
}

export function PersonCard({ person, instructors, onChange, onDelete }: Props) {
  return (
    <div className="person-card">
      <div className="person-header">
        <input className="name-input" value={person.name} onChange={(e) => onChange({ name: e.target.value })} />
        <span className="target-text">{person.target}</span>
        <button className="delete-btn" onClick={onDelete}>
          Remove
        </button>
      </div>
      <AlertTypeFields value={person} onChange={onChange} />
      <InstructorPicker
        excluded={person.excluded_instructors}
        included={person.included_instructors}
        allInstructors={instructors}
        onChange={onChange}
      />
      {person.types.includes("train_and_play") &&
        (person.excluded_instructors?.length || person.included_instructors?.length) && (
          <label className="toggle train-play-instructor-toggle">
            <input
              type="checkbox"
              checked={person.apply_instructor_filter_to_train_and_play ?? false}
              onChange={(e) => onChange({ apply_instructor_filter_to_train_and_play: e.target.checked })}
            />
            Apply instructor filter to Train &amp; Play?
          </label>
        )}
    </div>
  );
}
