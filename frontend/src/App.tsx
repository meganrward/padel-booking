import { useEffect, useState } from "react";
import { api, type AlertType, type Person } from "./api";
import { InstructorPicker } from "./InstructorPicker";
import "./App.css";

const TYPE_LABELS: { key: AlertType; label: string }[] = [
  { key: "courts", label: "Evening Courts" },
  { key: "lessons", label: "Lessons" },
  { key: "train_and_play", label: "Train & Play" },
  { key: "last_minute_courts", label: "Last minute courts" },
  { key: "matches", label: "Matches" },
];

function emptyPerson(): Person {
  return { name: "", target: "", types: [] };
}

export default function App() {
  const [people, setPeople] = useState<Person[]>([]);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [newPerson, setNewPerson] = useState<Person>(emptyPerson());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listPeople(), api.listInstructors()])
      .then(([p, i]) => {
        setPeople(p);
        setInstructors(i);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function refresh() {
    setPeople(await api.listPeople());
  }

  async function handleUpdate(target: string, patch: Partial<Person>) {
    const current = people.find((p) => p.target === target);
    if (!current) return;
    const next = { ...current, ...patch };
    setPeople((prev) => prev.map((p) => (p.target === target ? next : p)));
    try {
      await api.updatePerson(target, {
        name: next.name,
        types: next.types,
        level: next.level ?? undefined,
        excluded_instructors: next.excluded_instructors ?? undefined,
        included_instructors: next.included_instructors ?? undefined,
        apply_instructor_filter_to_train_and_play: next.apply_instructor_filter_to_train_and_play ?? false,
        matches_start_time: next.matches_start_time ?? undefined,
        matches_end_time: next.matches_end_time ?? undefined,
      });
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    }
  }

  function toggleType(person: Person, type: AlertType) {
    const types = person.types.includes(type)
      ? person.types.filter((t) => t !== type)
      : [...person.types, type];
    handleUpdate(person.target, { types });
  }

  async function handleDelete(target: string) {
    if (!confirm(`Remove ${target} from notifications?`)) return;
    const prev = people;
    setPeople((p) => p.filter((x) => x.target !== target));
    try {
      await api.deletePerson(target);
    } catch (e) {
      setError((e as Error).message);
      setPeople(prev);
    }
  }

  const canAddPerson = newPerson.name.trim() !== "" && newPerson.target.trim() !== "" && newPerson.types.length > 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canAddPerson) {
      setError("Name, contact, and at least one alert type are required.");
      return;
    }
    try {
      const created = await api.createPerson(newPerson);
      setPeople((p) => [...p, created]);
      setNewPerson(emptyPerson());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>Padel Notification Recipients</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="people-list">
        {people.map((person) => (
          <div className="person-card" key={person.target}>
            <div className="person-header">
              <input
                className="name-input"
                value={person.name}
                onChange={(e) => handleUpdate(person.target, { name: e.target.value })}
              />
              <span className="target-text">{person.target}</span>
              <button className="delete-btn" onClick={() => handleDelete(person.target)}>
                Remove
              </button>
            </div>
            <div className="toggles">
              {TYPE_LABELS.map(({ key, label }) => (
                <label key={key} className="toggle">
                  <input
                    type="checkbox"
                    checked={person.types.includes(key)}
                    onChange={() => toggleType(person, key)}
                  />
                  {label}
                </label>
              ))}
              {(person.types.includes("train_and_play") || person.types.includes("matches")) && (
                <label className="toggle level-input">
                  Level
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="e.g. 4.25"
                    value={person.level ?? ""}
                    onChange={(e) =>
                      handleUpdate(person.target, {
                        level: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
              {person.types.includes("matches") && (
                <label className="toggle level-input">
                  From
                  <input
                    type="time"
                    value={person.matches_start_time ?? ""}
                    onChange={(e) =>
                      handleUpdate(person.target, { matches_start_time: e.target.value || null })
                    }
                  />
                </label>
              )}
              {person.types.includes("matches") && (
                <label className="toggle level-input">
                  To
                  <input
                    type="time"
                    value={person.matches_end_time ?? ""}
                    onChange={(e) =>
                      handleUpdate(person.target, { matches_end_time: e.target.value || null })
                    }
                  />
                </label>
              )}
            </div>
            <InstructorPicker
              excluded={person.excluded_instructors}
              included={person.included_instructors}
              allInstructors={instructors}
              onChange={(patch) => handleUpdate(person.target, patch)}
            />
            {person.types.includes("train_and_play") &&
              (person.excluded_instructors?.length || person.included_instructors?.length) && (
                <label className="toggle train-play-instructor-toggle">
                  <input
                    type="checkbox"
                    checked={person.apply_instructor_filter_to_train_and_play ?? false}
                    onChange={(e) =>
                      handleUpdate(person.target, { apply_instructor_filter_to_train_and_play: e.target.checked })
                    }
                  />
                  Apply instructor filter to Train &amp; Play?
                </label>
              )}
          </div>
        ))}
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <h2>Add person</h2>
        <input
          placeholder="Name"
          value={newPerson.name}
          onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
        />
        <input
          placeholder="Email or +phone"
          value={newPerson.target}
          onChange={(e) => setNewPerson({ ...newPerson, target: e.target.value })}
        />
        <div className="toggles">
          {TYPE_LABELS.map(({ key, label }) => (
            <label key={key} className="toggle">
              <input
                type="checkbox"
                checked={newPerson.types.includes(key)}
                onChange={() =>
                  setNewPerson((p) => ({
                    ...p,
                    types: p.types.includes(key) ? p.types.filter((t) => t !== key) : [...p.types, key],
                  }))
                }
              />
              {label}
            </label>
          ))}
          {(newPerson.types.includes("train_and_play") || newPerson.types.includes("matches")) && (
            <label className="toggle level-input">
              Level
              <input
                type="number"
                step="0.25"
                min="0"
                placeholder="e.g. 4.25"
                value={newPerson.level ?? ""}
                onChange={(e) =>
                  setNewPerson((p) => ({
                    ...p,
                    level: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
          )}
          {newPerson.types.includes("matches") && (
            <label className="toggle level-input">
              From
              <input
                type="time"
                value={newPerson.matches_start_time ?? ""}
                onChange={(e) =>
                  setNewPerson((p) => ({ ...p, matches_start_time: e.target.value || null }))
                }
              />
            </label>
          )}
          {newPerson.types.includes("matches") && (
            <label className="toggle level-input">
              To
              <input
                type="time"
                value={newPerson.matches_end_time ?? ""}
                onChange={(e) =>
                  setNewPerson((p) => ({ ...p, matches_end_time: e.target.value || null }))
                }
              />
            </label>
          )}
        </div>
        <button type="submit" disabled={!canAddPerson}>
          Add person
        </button>
      </form>
    </div>
  );
}
