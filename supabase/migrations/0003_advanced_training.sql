-- Advanced Training / Train to Compete: gender column for eligibility gating.
-- Admin-set only (via Supabase SQL editor) — never written from the frontend.
alter table public.preferences
  add column gender text check (gender in ('male', 'female'));
