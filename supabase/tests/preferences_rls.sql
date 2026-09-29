begin;
select plan(7);

-- Two fake friends; the on_auth_user_created trigger gives each an empty
-- preferences row automatically.
insert into auth.users (id, email, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@test.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'bob@test.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

select is(
  (select count(*) from public.preferences)::int, 2,
  'trigger creates a preferences row per new auth user'
);

select is(
  (select notification_method from public.preferences where id = '00000000-0000-0000-0000-000000000001'), 'imessage',
  'new rows default to imessage until a friend opts into ntfy'
);

-- As alice: can see and edit only her own row.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.preferences)::int, 1,
  'alice sees only her own row via select policy'
);

select is(
  (select id from public.preferences limit 1), '00000000-0000-0000-0000-000000000001'::uuid,
  'the row alice sees is her own'
);

update public.preferences set name = 'Alice' where id = '00000000-0000-0000-0000-000000000001';
select is(
  (select name from public.preferences where id = '00000000-0000-0000-0000-000000000001'), 'Alice',
  'alice can update her own row'
);

update public.preferences set name = 'Hacked' where id = '00000000-0000-0000-0000-000000000002';
select is(
  (select count(*) from public.preferences where id = '00000000-0000-0000-0000-000000000002' and name = 'Hacked')::int, 0,
  'alice cannot update bob''s row'
);

-- As an anonymous request (no JWT claims): sees nothing.
reset role;
set local role anon;
reset "request.jwt.claims";

select is(
  (select count(*) from public.preferences)::int, 0,
  'anon has no access to any preferences row'
);

select * from finish();
rollback;
