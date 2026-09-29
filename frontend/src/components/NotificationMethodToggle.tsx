import type { NotificationMethod } from "../lib/preferences";
import { generateNtfyTopic } from "../lib/preferences.utils";

interface Props {
  name: string;
  method: NotificationMethod;
  ntfyTopic: string | null;
  onChange: (patch: { notification_method: NotificationMethod; ntfy_topic?: string | null }) => void;
}

export function NotificationMethodToggle({ name, method, ntfyTopic, onChange }: Props) {
  function selectMethod(next: NotificationMethod) {
    if (next === "ntfy" && !ntfyTopic) {
      onChange({ notification_method: next, ntfy_topic: generateNtfyTopic(name) });
    } else {
      onChange({ notification_method: next });
    }
  }

  return (
    <div className="notification-method">
      <label className="toggle">
        <input
          type="radio"
          name="notification-method"
          checked={method === "imessage"}
          onChange={() => selectMethod("imessage")}
        />
        iMessage
      </label>
      <label className="toggle">
        <input
          type="radio"
          name="notification-method"
          checked={method === "ntfy"}
          onChange={() => selectMethod("ntfy")}
        />
        ntfy
      </label>
      {method === "ntfy" && ntfyTopic && (
        <div className="ntfy-setup">
          <p>
            To receive alerts, install the{" "}
            <a href="https://ntfy.sh" target="_blank" rel="noreferrer">
              ntfy app
            </a>{" "}
            and add a subscription with this exact topic name:
          </p>
          <code>{ntfyTopic}</code>
        </div>
      )}
    </div>
  );
}
