import type { Preferences } from "../lib/preferences";
import { AlertTypeFields } from "./AlertTypeFields";
import { InstructorPicker } from "./InstructorPicker";
import { NotificationMethodToggle } from "./NotificationMethodToggle";

interface Props {
  preferences: Preferences;
  instructors: string[];
  onChange: (patch: Partial<Preferences>) => void;
}

export function PreferencesEditor({ preferences, instructors, onChange }: Props) {
  return (
    <div className="person-card">
      <div className="person-header">
        <input
          className="name-input"
          value={preferences.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <span className="target-text">{preferences.target}</span>
      </div>
      <AlertTypeFields value={preferences} onChange={onChange} />
      <InstructorPicker
        excluded={preferences.excluded_instructors}
        included={preferences.included_instructors}
        allInstructors={instructors}
        onChange={onChange}
      />
      {preferences.types.includes("train_and_play") &&
        (preferences.excluded_instructors?.length || preferences.included_instructors?.length) && (
          <label className="toggle train-play-instructor-toggle">
            <input
              type="checkbox"
              checked={preferences.apply_instructor_filter_to_train_and_play}
              onChange={(e) => onChange({ apply_instructor_filter_to_train_and_play: e.target.checked })}
            />
            Apply coach filter to Train &amp; Play?
          </label>
        )}
      <NotificationMethodToggle
        name={preferences.name}
        method={preferences.notification_method}
        ntfyTopic={preferences.ntfy_topic}
        onChange={onChange}
      />
    </div>
  );
}
