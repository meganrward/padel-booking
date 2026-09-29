import { useState } from "react";
import { api, type CourtSlot } from "../api";

function groupByDate(slots: CourtSlot[]): { date_label: string; slots: CourtSlot[] }[] {
  const groups: { date_label: string; slots: CourtSlot[] }[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && last.date_label === slot.date_label) {
      last.slots.push(slot);
    } else {
      groups.push({ date_label: slot.date_label, slots: [slot] });
    }
  }
  return groups;
}

export function FreeCourtFinder() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [results, setResults] = useState<CourtSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = startDate !== "" && endDate !== "" && startTime !== "" && endTime !== "";

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      const slots = await api.searchCourts({
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
      });
      setResults(slots);
    } catch (err) {
      setError((err as Error).message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="court-finder">
      <h2>Find free courts</h2>
      <form className="add-form" onSubmit={handleSearch}>
        <div className="court-finder-row">
          <label className="court-finder-field">
            From date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="court-finder-field">
            To date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>
        <div className="court-finder-row">
          <label className="court-finder-field">
            From time
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
          <label className="court-finder-field">
            To time
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>
        </div>
        <button type="submit" disabled={!canSearch || loading}>
          {loading ? "Searching..." : "Find free courts"}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {results && (
        <div className="court-results">
          {results.length === 0 ? (
            <p className="court-results-empty">No free courts found in that range.</p>
          ) : (
            groupByDate(results).map((group) => (
              <div key={group.date_label} className="court-results-day">
                <h3>{group.date_label}</h3>
                <ul>
                  {group.slots.map((slot) => (
                    <li key={`${slot.court}-${slot.start}`}>
                      {slot.court} — {slot.start}–{slot.end} ({slot.duration_mins} min)
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
