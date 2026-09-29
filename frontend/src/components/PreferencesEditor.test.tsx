import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesEditor } from "./PreferencesEditor";
import type { Preferences } from "../lib/preferences";

function samplePreferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    id: "user-1",
    name: "Megan",
    target: "megan@example.com",
    types: [],
    level: null,
    excluded_instructors: null,
    included_instructors: null,
    apply_instructor_filter_to_train_and_play: false,
    matches_start_time: null,
    matches_end_time: null,
    notification_method: "imessage",
    ntfy_topic: null,
    ...overrides,
  };
}

describe("PreferencesEditor", () => {
  it("toggling an alert type calls onChange with the updated types list", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<PreferencesEditor preferences={samplePreferences()} instructors={[]} onChange={onChange} />);
    await user.click(screen.getByLabelText("Evening Courts"));

    expect(onChange).toHaveBeenCalledWith({ types: ["courts"] });
  });

  it("switching to ntfy generates and includes a topic", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<PreferencesEditor preferences={samplePreferences()} instructors={[]} onChange={onChange} />);
    await user.click(screen.getByLabelText("ntfy"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ notification_method: "ntfy", ntfy_topic: expect.stringMatching(/^padel-megan-/) }),
    );
  });

  it("shows ntfy setup instructions once a topic exists", () => {
    const onChange = vi.fn();

    render(
      <PreferencesEditor
        preferences={samplePreferences({ notification_method: "ntfy", ntfy_topic: "padel-megan-ab12cd" })}
        instructors={[]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("padel-megan-ab12cd")).toBeInTheDocument();
    expect(screen.getByText(/install the/i)).toBeInTheDocument();
  });
});
