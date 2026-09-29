import { useState } from "react";
import { Checkbox } from "./ui";

type Mode = "none" | "exclude" | "include";

interface Props {
  excluded: string[] | null | undefined;
  included: string[] | null | undefined;
  allInstructors: string[];
  onChange: (next: { excluded_instructors?: string[]; included_instructors?: string[] }) => void;
}

function initialMode(excluded: string[] | null | undefined, included: string[] | null | undefined): Mode {
  if (included && included.length > 0) return "include";
  if (excluded && excluded.length > 0) return "exclude";
  return "none";
}

export function InstructorPicker({ excluded, included, allInstructors, onChange }: Props) {
  // Mode is local state, not derived from excluded/included every render — those arrays
  // start empty the moment a mode is picked, so deriving from length alone would snap
  // straight back to "none".
  const [mode, setModeState] = useState<Mode>(() => initialMode(excluded, included));
  const active = mode === "include" ? included ?? [] : mode === "exclude" ? excluded ?? [] : [];

  // Names shown below with a checkbox this session — grows as instructors are picked,
  // never shrinks on uncheck (so unchecking is easy to undo until the page is refreshed).
  const [shown, setShown] = useState<string[]>(() => active);
  const [customName, setCustomName] = useState("");

  function handleModeSelect(next: Mode) {
    setModeState(next);
    setShown([]);
    if (next === "none") onChange({ excluded_instructors: undefined, included_instructors: undefined });
    else if (next === "exclude") onChange({ excluded_instructors: [], included_instructors: undefined });
    else onChange({ included_instructors: [], excluded_instructors: undefined });
  }

  function setActive(next: string[]) {
    if (mode === "exclude") onChange({ excluded_instructors: next, included_instructors: undefined });
    else if (mode === "include") onChange({ included_instructors: next, excluded_instructors: undefined });
  }

  function toggleChecked(name: string) {
    const next = active.includes(name) ? active.filter((n) => n !== name) : [...active, name];
    setActive(next);
  }

  function pickFromDropdown(name: string) {
    if (!name) return;
    if (!shown.includes(name)) setShown((prev) => [...prev, name]);
    if (!active.includes(name)) setActive([...active, name]);
  }

  function addCustom() {
    const name = customName.trim().toLowerCase();
    if (!name) return;
    pickFromDropdown(name);
    setCustomName("");
  }

  const dropdownOptions = allInstructors.filter((n) => !shown.includes(n));

  return (
    <>
      <select
        className="select"
        aria-label="Coach filter"
        value={mode}
        onChange={(e) => handleModeSelect(e.target.value as Mode)}
      >
        <option value="none">All coaches</option>
        <option value="exclude">Exclude specific coaches</option>
        <option value="include">Only these coaches</option>
      </select>
      {mode !== "none" && (
        <>
          <select
            className="select"
            aria-label="Add coach from list"
            value=""
            onChange={(e) => pickFromDropdown(e.target.value)}
            disabled={dropdownOptions.length === 0}
          >
            <option value="" disabled>
              {dropdownOptions.length === 0 ? "All coaches added" : "Add coach…"}
            </option>
            {dropdownOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {shown.length > 0 && (
            <div className="checklist">
              {shown.map((name) => (
                <Checkbox key={name} label={name} checked={active.includes(name)} onChange={() => toggleChecked(name)} />
              ))}
            </div>
          )}

          <div className="inline-add">
            <input
              className="input"
              type="text"
              aria-label="Instructor name"
              placeholder="Add instructor name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button type="button" className="btn btn-secondary" onClick={addCustom}>
              Add
            </button>
          </div>
        </>
      )}
    </>
  );
}
