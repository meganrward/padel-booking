import type { NotificationMethod } from "../lib/preferences";
import { generateNtfyTopic } from "../lib/preferences.utils";
import { SegmentedControl, Topic } from "./ui";

interface Props {
  name: string;
  method: NotificationMethod;
  ntfyTopic: string | null;
  onChange: (patch: { notification_method: NotificationMethod; ntfy_topic?: string | null }) => void;
}

const METHODS: { value: NotificationMethod; label: string }[] = [
  { value: "imessage", label: "iMessage" },
  { value: "ntfy", label: "ntfy" },
];

export function NotificationMethodToggle({ name, method, ntfyTopic, onChange }: Props) {
  function selectMethod(next: NotificationMethod) {
    if (next === "ntfy" && !ntfyTopic) {
      onChange({ notification_method: next, ntfy_topic: generateNtfyTopic(name) });
    } else {
      onChange({ notification_method: next });
    }
  }

  return (
    <>
      <SegmentedControl label="Notify me by" options={METHODS} value={method} onChange={selectMethod} />
      {method === "ntfy" && ntfyTopic && (
        <div className="ntfy-setup">
          <p>
            To receive alerts, install the{" "}
            <a href="https://ntfy.sh" target="_blank" rel="noreferrer">
              ntfy app
            </a>{" "}
            and add a subscription with this exact topic name:
          </p>
          <Topic value={ntfyTopic} />
        </div>
      )}
    </>
  );
}
