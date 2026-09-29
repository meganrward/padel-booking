import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type AlertType = "lessons" | "train_and_play" | "courts" | "last_minute_courts" | "matches";
export type NotificationMethod = "imessage" | "ntfy";

export interface Preferences {
  id: string;
  name: string;
  target: string;
  types: AlertType[];
  level: number | null;
  excluded_instructors: string[] | null;
  included_instructors: string[] | null;
  apply_instructor_filter_to_train_and_play: boolean;
  matches_start_time: string | null;
  matches_end_time: string | null;
  notification_method: NotificationMethod;
  ntfy_topic: string | null;
}

const PREFERENCES_COLUMNS =
  "id, name, target, types, level, excluded_instructors, included_instructors, " +
  "apply_instructor_filter_to_train_and_play, matches_start_time, matches_end_time, " +
  "notification_method, ntfy_topic";

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function updateOwnPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function requireCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

export async function fetchOwnPreferences(): Promise<Preferences> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("preferences")
    .select(PREFERENCES_COLUMNS)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as unknown as Preferences;
}

export async function updateOwnPreferences(patch: Partial<Omit<Preferences, "id">>): Promise<Preferences> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("preferences")
    .update(patch)
    .eq("id", userId)
    .select(PREFERENCES_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as Preferences;
}
