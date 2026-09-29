import { useEffect, useState } from "react";
import { api, type Person } from "./api";
import { AddPersonForm } from "./components/AddPersonForm";
import { FreeCourtFinder } from "./components/FreeCourtFinder";
import { PersonCard } from "./components/PersonCard";
import "./App.css";

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

      <FreeCourtFinder />

      <div className="people-list">
        {people.map((person) => (
          <PersonCard
            key={person.target}
            person={person}
            instructors={instructors}
            onChange={(patch) => handleUpdate(person.target, patch)}
            onDelete={() => handleDelete(person.target)}
          />
        ))}
      </div>

      <AddPersonForm value={newPerson} onChange={setNewPerson} onSubmit={handleAdd} canSubmit={canAddPerson} />
    </div>
  );
}
