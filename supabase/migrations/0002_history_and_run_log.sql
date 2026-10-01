-- Audit trail for preference edits, and a run log for the scraper.

-- One row per update to `preferences`, capturing the row as it was
-- *before* the change (plus who and when). Lets us answer "when did
-- someone last change their prefs, and what did they change".
create table public.preferences_history (
  id bigint generated always as identity primary key,
  preference_id uuid not null references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now(),
  old_row jsonb not null
);

alter table public.preferences_history enable row level security;

-- Same access shape as `preferences` itself: friends can see their own history only.
create policy "select own history" on public.preferences_history
  for select using (preference_id = auth.uid());

create function public.handle_preferences_update()
returns trigger as $$
begin
  insert into public.preferences_history (preference_id, old_row)
  values (old.id, to_jsonb(old));
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer;

create trigger on_preferences_update
  before update on public.preferences
  for each row execute function public.handle_preferences_update();

-- One row per scraper run (check_padel.py), for visibility into how often
-- it's running and whether it's finding/notifying anything. Not tied to a
-- user — the scraper is a single scheduled job, not a per-user request.
create table public.run_log (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  slots_available integer not null,
  activities_notified integer not null,
  court_slots_notified integer not null,
  last_minute_court_slots_notified integer not null,
  matches_notified integer not null,
  error text
);

alter table public.run_log enable row level security;

-- No select policy: nobody can read it via the anon/authenticated roles.
-- Written with the service-role key (bypasses RLS) and viewed via the
-- Supabase dashboard's table editor.
