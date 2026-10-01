begin;
select plan(5);

insert into auth.users (id, email, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@test.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'bob@test.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

update public.preferences set name = 'Alice' where id = '00000000-0000-0000-0000-000000000001';
update public.preferences set name = 'Bob' where id = '00000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from public.preferences_history)::int, 2,
  'an update trigger writes one history row per change'
);

select is(
  (select (old_row->>'name') from public.preferences_history where preference_id = '00000000-0000-0000-0000-000000000001'),
  'alice', -- handle_new_user() seeded the row with the email local-part before this update
  'history captures the pre-update row, not the new one'
);

-- As alice: can see only her own history.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.preferences_history)::int, 1,
  'alice sees only her own history row via select policy'
);

select is(
  (select preference_id from public.preferences_history limit 1), '00000000-0000-0000-0000-000000000001'::uuid,
  'the history row alice sees is her own'
);

-- As an anonymous request (no JWT claims): sees nothing.
reset role;
set local role anon;
reset "request.jwt.claims";

select is(
  (select count(*) from public.preferences_history)::int, 0,
  'anon has no access to any preferences_history row'
);

select * from finish();
rollback;
