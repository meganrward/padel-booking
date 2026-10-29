-- Which slots each person has already been alerted about, so no one is notified twice
-- (including when the scraper runs on more than one machine). recipient_id is a
-- preferences.id, or 'owner' for the scraper owner's own desktop/ntfy notification.
-- The scraper claims a row with an insert before sending; only the run whose insert
-- succeeds sends the notification. Rows older than 28 days are pruned by the scraper.

create table public.notified_slots (
  slot_key text not null,
  recipient_id text not null,
  notified_at timestamptz not null default now(),
  primary key (slot_key, recipient_id)
);

alter table public.notified_slots enable row level security;

-- No policies: written and read only with the service-role key, like run_log.
