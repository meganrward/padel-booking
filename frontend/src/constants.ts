import type { AlertType } from "./lib/preferences";

export const TYPE_LABELS: { key: AlertType; label: string }[] = [
  { key: "courts", label: "Evening courts" },
  { key: "lessons", label: "Lessons" },
  { key: "train_and_play", label: "Train & Plays" },
  { key: "advanced_training", label: "Train to Compete" },
  { key: "last_minute_courts", label: "Last minute courts" },
  { key: "matches", label: "Matches" },
];
