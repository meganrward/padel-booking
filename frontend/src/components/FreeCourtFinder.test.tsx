import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FreeCourtFinder } from "./FreeCourtFinder";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    searchCourts: vi.fn(),
  },
}));

const mockedSearchCourts = vi.mocked(api.searchCourts);

describe("FreeCourtFinder", () => {
  it("defaults the minimum duration to 90 minutes", () => {
    render(<FreeCourtFinder />);
    expect(screen.getByText("90 min")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("90");
  });

  it("defaults the time range to all day", () => {
    render(<FreeCourtFinder />);
    expect(screen.getByLabelText("From time")).toHaveValue("00:00");
    expect(screen.getByLabelText("To time")).toHaveValue("23:59");
  });

  it("defaults the from date to today", () => {
    render(<FreeCourtFinder />);
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText("From date")).toHaveValue(today);
  });

  it("greys out to-times before the from time by setting min on the field", () => {
    render(<FreeCourtFinder />);
    fireEvent.change(screen.getByLabelText("From time"), { target: { value: "18:00" } });
    expect(screen.getByLabelText("To time")).toHaveAttribute("min", "18:00");
  });

  it("sends the chosen duration and time range when searching", async () => {
    mockedSearchCourts.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<FreeCourtFinder />);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-01" } });
    await user.type(screen.getByLabelText("To date"), "2026-10-02");
    fireEvent.change(screen.getByLabelText("From time"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("To time"), { target: { value: "21:00" } });
    fireEvent.change(screen.getByRole("slider"), { target: { value: "150" } });
    expect(screen.getByText("150 min")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /find free courts/i }));

    expect(mockedSearchCourts).toHaveBeenCalledWith({
      start_date: "2026-10-01",
      end_date: "2026-10-02",
      start_time: "18:00",
      end_time: "21:00",
      duration_mins: 150,
    });
  });
});
