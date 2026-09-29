export interface CourtSlot {
  date: string;
  date_label: string;
  court: string;
  start: string;
  end: string;
  duration_mins: number;
}

export type CourtSearchDuration = 60 | 90 | 120 | 150 | 180;

export interface CourtSearchParams {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  duration_mins: CourtSearchDuration;
}

const BASE_URL = import.meta.env.VITE_SEARCH_SERVICE_URL;

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
  listInstructors: () => request<string[]>("/api/instructors"),
  searchCourts: (params: CourtSearchParams) =>
    request<CourtSlot[]>("/api/courts/search", { method: "POST", body: JSON.stringify(params) }),
};
