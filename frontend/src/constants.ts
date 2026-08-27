import type { AlertType } from "./api";

export const TYPE_LABELS: { key: AlertType; label: string }[] = [
  { key: "courts", label: "Evening Courts" },
  { key: "lessons", label: "Lessons" },
  { key: "train_and_play", label: "Train & Play" },
  { key: "last_minute_courts", label: "Last minute courts" },
  { key: "matches", label: "Matches" },
];
