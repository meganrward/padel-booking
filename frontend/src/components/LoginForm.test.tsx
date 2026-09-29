import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";
import { signInWithPassword } from "../lib/preferences";

vi.mock("../lib/preferences", () => ({
  signInWithPassword: vi.fn(),
}));

const mockedSignIn = vi.mocked(signInWithPassword);

describe("LoginForm", () => {
  it("signs in with the entered credentials and notifies on success", async () => {
    mockedSignIn.mockResolvedValue(undefined);
    const onSignedIn = vi.fn();
    const user = userEvent.setup();

    render(<LoginForm onSignedIn={onSignedIn} />);
    await user.type(screen.getByPlaceholderText("Email"), "friend@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(mockedSignIn).toHaveBeenCalledWith("friend@example.com", "hunter2");
    expect(onSignedIn).toHaveBeenCalled();
  });

  it("shows an error and does not call onSignedIn when sign-in fails", async () => {
    mockedSignIn.mockRejectedValue(new Error("Invalid login credentials"));
    const onSignedIn = vi.fn();
    const user = userEvent.setup();

    render(<LoginForm onSignedIn={onSignedIn} />);
    await user.type(screen.getByPlaceholderText("Email"), "friend@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText("Invalid login credentials")).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
