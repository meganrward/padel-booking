function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateNtfyTopic(name: string): string {
  const slug = slugify(name) || "friend";
  const random = Math.random().toString(36).slice(2, 8);
  return `padel-${slug}-${random}`;
}

const ADVANCED_TRAINING_MIN_LEVEL: Record<"male" | "female", number> = {
  male: 5,
  female: 4,
};

export function isEligibleForAdvancedTraining(
  gender: "male" | "female" | null,
  level: number | null,
): boolean {
  if (!gender || level == null) return false;
  return level >= ADVANCED_TRAINING_MIN_LEVEL[gender];
}
