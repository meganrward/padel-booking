export type AlertType = "lessons" | "train_and_play" | "courts" | "last_minute_courts";

export interface Person {
  name: string;
  target: string;
  types: AlertType[];
  level?: number | null;
  excluded_instructors?: string[] | null;
  included_instructors?: string[] | null;
}

const BASE_URL = "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listPeople: () => request<Person[]>("/api/people"),
  createPerson: (person: Person) =>
    request<Person>("/api/people", { method: "POST", body: JSON.stringify(person) }),
  updatePerson: (target: string, person: Omit<Person, "target">) =>
    request<Person>(`/api/people/${encodeURIComponent(target)}`, {
      method: "PUT",
      body: JSON.stringify(person),
    }),
  deletePerson: (target: string) =>
    request<void>(`/api/people/${encodeURIComponent(target)}`, { method: "DELETE" }),
  listInstructors: () => request<string[]>("/api/instructors"),
};
