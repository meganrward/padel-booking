import { useState } from "react";
import { api, type CourtSearchDuration, type CourtSlot } from "../api";
import { Banner, Card, Field, Spinner } from "./ui";

const MIN_DURATION: CourtSearchDuration = 60;
const MAX_DURATION: CourtSearchDuration = 180;
const DURATION_STEP = 30;

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  const [startDate, setStartDate] = useState(todayDateString());
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [durationMins, setDurationMins] = useState<CourtSearchDuration>(90);
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
        duration_mins: durationMins,
      });
      setResults(slots);
    } catch (err) {
      setError((err as Error).message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  const fillPercent = ((durationMins - MIN_DURATION) / (MAX_DURATION - MIN_DURATION)) * 100;
  const ticks: number[] = [];
  for (let m = MIN_DURATION; m <= MAX_DURATION; m += DURATION_STEP) ticks.push(m);

  return (
    <Card title="Find free courts">
      <form className="form" onSubmit={handleSearch}>
        <div className="field-row">
          <Field label="From date">
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label="To date">
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </Field>
        </div>
        <div className="field-row">
          <Field label="From time">
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </Field>
          <Field label="To time">
            <input
              className="input"
              type="time"
              value={endTime}
              min={startTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="field">
          <div className="slider-head">
            <label className="field-label" htmlFor="duration-slider">
              Minimum duration
            </label>
            <span className="slider-value" aria-hidden="true">
              {durationMins} min
            </span>
          </div>
          <input
            id="duration-slider"
            className="range"
            type="range"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={DURATION_STEP}
            value={durationMins}
            aria-valuetext={`${durationMins} minutes`}
            style={{ "--fill": `${fillPercent}%` } as React.CSSProperties}
            onChange={(e) => setDurationMins(Number(e.target.value) as CourtSearchDuration)}
          />
          <div className="ticks" aria-hidden="true">
            {ticks.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!canSearch || loading} aria-busy={loading || undefined}>
          {loading && <Spinner />}
          {loading ? "Searching…" : "Find free courts"}
        </button>
      </form>

      {error && <Banner tone="error">{error}</Banner>}

      {results &&
        (results.length === 0 ? (
          <p className="empty">No free courts found in that range.</p>
        ) : (
          <div className="slots">
            {groupByDate(results).map((group) => (
              <div key={group.date_label} className="slot-day">
                <h3>
                  {group.date_label}
                  <span className="slot-count">
                    {group.slots.length} {group.slots.length === 1 ? "slot" : "slots"}
                  </span>
                </h3>
                <ul>
                  {group.slots.map((slot) => (
                    <li key={`${slot.court}-${slot.start}`} className="slot">
                      <span className="slot-dot" aria-hidden="true" />
                      <span className="slot-main">
                        <span className="slot-court">{slot.court}</span>
                        <span className="slot-time">
                          {slot.start}–{slot.end}
                        </span>
                      </span>
                      <span className="slot-dur">{slot.duration_mins} min</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
    </Card>
  );
}
