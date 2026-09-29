import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchOwnPreferences,
  getCurrentUser,
  signInWithPassword,
  signOut,
  updateOwnPassword,
  updateOwnPreferences,
} from "./preferences";
import { supabase } from "./supabaseClient";

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockedSupabase = vi.mocked(supabase, { deep: true });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signInWithPassword", () => {
  it("signs in with the given credentials", async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);

    await signInWithPassword("friend@example.com", "hunter2");

    expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "friend@example.com",
      password: "hunter2",
    });
  });

  it("throws when Supabase returns an error", async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error("Invalid login credentials"),
    } as never);

    await expect(signInWithPassword("friend@example.com", "wrong")).rejects.toThrow(
      "Invalid login credentials",
    );
  });
});

describe("updateOwnPassword", () => {
  it("updates the current user's password", async () => {
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: null } as never);

    await updateOwnPassword("new-password");

    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
  });
});

describe("signOut", () => {
  it("signs the current user out", async () => {
    mockedSupabase.auth.signOut.mockResolvedValue({ error: null } as never);

    await signOut();

    expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
  });
});

describe("getCurrentUser", () => {
  it("returns the current user from the session", async () => {
    const user = { id: "user-1" };
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null } as never);

    await expect(getCurrentUser()).resolves.toBe(user);
  });

  it("returns null when nobody is signed in", async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null } as never);

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("fetchOwnPreferences", () => {
  it("throws when nobody is signed in", async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null } as never);

    await expect(fetchOwnPreferences()).rejects.toThrow("Not signed in");
  });

  it("fetches the signed-in user's preferences row", async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    const single = vi.fn().mockResolvedValue({ data: { id: "user-1", name: "Megan" }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select } as never);

    const result = await fetchOwnPreferences();

    expect(mockedSupabase.from).toHaveBeenCalledWith("preferences");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toEqual({ id: "user-1", name: "Megan" });
  });
});

describe("updateOwnPreferences", () => {
  it("updates only the signed-in user's own row", async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    const single = vi.fn().mockResolvedValue({ data: { id: "user-1", name: "Megan W" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ update } as never);

    const result = await updateOwnPreferences({ name: "Megan W" });

    expect(update).toHaveBeenCalledWith({ name: "Megan W" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toEqual({ id: "user-1", name: "Megan W" });
  });
});
