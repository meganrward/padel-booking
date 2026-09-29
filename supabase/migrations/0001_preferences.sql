-- Preference rows for friends using the padel court finder.
-- One row per auth user; RLS restricts each friend to their own row.
-- The scraper reads this table using the service-role key, which bypasses RLS.

create table public.preferences (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  target text not null,
  types text[] not null default '{}',
  level numeric,
  excluded_instructors text[],
  included_instructors text[],
  apply_instructor_filter_to_train_and_play boolean not null default false,
  matches_start_time text,
  matches_end_time text,
  ntfy_topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preferences enable row level security;

create policy "select own row" on public.preferences
  for select using (id = auth.uid());

create policy "update own row" on public.preferences
  for update using (id = auth.uid());

create policy "insert own row" on public.preferences
  for insert with check (id = auth.uid());

-- Creates an empty preferences row as soon as an account exists, so the
-- scraper never silently skips someone who hasn't opened the prefs UI yet.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.preferences (id, name, target, types)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email, '{}');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
