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
