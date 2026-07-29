import { useState } from "react";

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
    <div className="instructor-picker">
      <select value={mode} onChange={(e) => handleModeSelect(e.target.value as Mode)}>
        <option value="none">All instructors</option>
        <option value="exclude">Exclude specific instructors</option>
        <option value="include">Only these instructors</option>
      </select>
      {mode !== "none" && (
        <div className="instructor-picker-body">
          <select
            value=""
            onChange={(e) => pickFromDropdown(e.target.value)}
            disabled={dropdownOptions.length === 0}
          >
            <option value="" disabled>
              {dropdownOptions.length === 0 ? "All instructors added" : "Add instructor..."}
            </option>
            {dropdownOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {shown.length > 0 && (
            <div className="instructor-checklist">
              {shown.map((name) => (
                <label key={name} className="instructor-checkbox">
                  <input type="checkbox" checked={active.includes(name)} onChange={() => toggleChecked(name)} />
                  {name}
                </label>
              ))}
            </div>
          )}

          <div className="instructor-add">
            <input
              type="text"
              placeholder="Add instructor name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button type="button" onClick={addCustom}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
