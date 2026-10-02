-- Distinguish scheduled runs (launchd) from ones Megan kicks off by hand.

alter table public.run_log
  add column trigger_source text not null default 'manual'
    check (trigger_source in ('cron', 'manual'));
