import type { Preferences } from "../lib/preferences";
import { AlertTypeFields } from "./AlertTypeFields";
import { InstructorPicker } from "./InstructorPicker";
import { NotificationMethodToggle } from "./NotificationMethodToggle";
import { Card, Checkbox, Field } from "./ui";

interface Props {
  preferences: Preferences;
  instructors: string[];
  onChange: (patch: Partial<Preferences>) => void;
}

export function PreferencesEditor({ preferences, instructors, onChange }: Props) {
  const hasInstructorFilter = Boolean(
    preferences.excluded_instructors?.length || preferences.included_instructors?.length,
  );

  return (
    <Card title="My alerts" description={`Sent to ${preferences.target}`}>
      <Field label="Name">
        <input className="input" value={preferences.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>

      <div className="section">
        <h3 className="section-title">Alert me about</h3>
        <AlertTypeFields value={preferences} onChange={onChange} />
      </div>

      <div className="section">
        <h3 className="section-title">Coaches</h3>
        <InstructorPicker
          excluded={preferences.excluded_instructors}
          included={preferences.included_instructors}
          allInstructors={instructors}
          onChange={onChange}
        />
        {preferences.types.includes("train_and_play") && hasInstructorFilter && (
          <Checkbox
            label="Apply coach filter to Train & Plays?"
            checked={preferences.apply_instructor_filter_to_train_and_play}
            onChange={(checked) => onChange({ apply_instructor_filter_to_train_and_play: checked })}
          />
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Notify me by</h3>
        <NotificationMethodToggle
          name={preferences.name}
          method={preferences.notification_method}
          ntfyTopic={preferences.ntfy_topic}
          onChange={onChange}
        />
      </div>
    </Card>
  );
}
