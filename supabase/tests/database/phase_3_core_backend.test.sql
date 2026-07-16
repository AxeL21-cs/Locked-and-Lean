begin;

create extension if not exists pgtap with schema extensions;
select plan(40);
set constraints all deferred;

create temporary table phase_3_ids (
  key text primary key,
  id uuid not null
);
grant all on table phase_3_ids to authenticated;

insert into auth.users (id, email)
values
  ('31111111-1111-4111-8111-111111111111', 'phase3-a@example.test'),
  ('32222222-2222-4222-8222-222222222222', 'phase3-b@example.test');

insert into public.chatgpt_log_previews (
  id, user_id, source_kind, status, revision_number, last_presented_at, expires_at
) values (
  '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '31111111-1111-4111-8111-111111111111',
  'chatgpt', 'ready', 1, '2026-07-13 10:00:00+00', now() + interval '1 hour'
);
insert into public.food_log_preview_revisions (
  preview_id, revision_number, user_id, meal_type, consumed_at, time_zone,
  original_description, total_calories, total_protein_g,
  total_carbohydrates_g, total_fat_g, presented_at
) values (
  '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1,
  '31111111-1111-4111-8111-111111111111', 'snack',
  '2026-07-14 01:00:00+08', 'Asia/Manila', 'ChatGPT fixture',
  300, 10, 40, 10, '2026-07-13 10:00:00+00'
);
insert into public.food_log_preview_items (
  preview_id, revision_number, user_id, ordinal, food_name, quantity, unit,
  calories, protein_g, carbohydrates_g, fat_g, provider,
  is_estimated, confidence, uncertainty
) values (
  '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1,
  '31111111-1111-4111-8111-111111111111', 1, 'ChatGPT fixture food',
  1, 'serving', 300, 10, 40, 10, 'fixture', true, 0.7,
  '["fixture uncertainty"]'::jsonb
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $$ select * from public.upsert_profile(
    'Teen', '2010-01-01', 'female', 160, 'metric', 'Asia/Manila'
  ) $$,
  '22023',
  'personalized targets require an adult aged 18 to 120',
  'under-18 onboarding is rejected'
);

select results_eq(
  $$ select display_name, time_zone from public.upsert_profile(
    'User A', '1990-01-01', 'female', 160, 'metric', 'Asia/Manila'
  ) $$,
  $$ values ('User A'::text, 'Asia/Manila'::text) $$,
  'profile upsert derives the authenticated owner'
);

set local "request.jwt.claims" =
  '{"sub":"32222222-2222-4222-8222-222222222222","role":"authenticated"}';
select results_eq(
  $$ select display_name from public.upsert_profile(
    'User B', '1988-06-01', 'male', 175, 'metric', 'Asia/Manila'
  ) $$,
  $$ values ('User B'::text) $$,
  'second user can create only their own profile'
);

set local "request.jwt.claims" =
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into phase_3_ids (key, id)
select 'target_a', target_id
from public.propose_nutrition_target(
  20, 'sedentary', 'lose', 1,
  (now() at time zone 'Asia/Manila')::date
);

select is(
  (select status from public.nutrition_targets where id = (select id from phase_3_ids where key = 'target_a')),
  'proposed',
  'target calculation creates a proposal, not an active target'
);
select is(
  (select calorie_target from public.nutrition_targets where id = (select id from phase_3_ids where key = 'target_a')),
  1200::numeric,
  'female Mifflin-St Jeor target respects the versioned 1200 kcal floor'
);
select is(
  (select onboarding_completed_at from public.profiles where user_id = '31111111-1111-4111-8111-111111111111'),
  null::timestamptz,
  'proposal alone does not complete onboarding'
);
select throws_ok(
  $$ select * from public.confirm_nutrition_target(
    (select id from phase_3_ids where key = 'target_a'), false
  ) $$,
  '22023', 'explicit confirmation is required',
  'target activation requires explicit true'
);
select results_eq(
  $$ select status, calorie_target from public.confirm_nutrition_target(
    (select id from phase_3_ids where key = 'target_a'), true
  ) $$,
  $$ values ('confirmed'::text, 1200::numeric) $$,
  'explicit confirmation activates the exact proposal'
);
select ok(
  (select onboarding_completed_at is not null from public.profiles
   where user_id = '31111111-1111-4111-8111-111111111111'),
  'confirmed target completes onboarding'
);
select is(
  (select count(*) from public.nutrition_targets where status = 'confirmed' and effective_to is null),
  1::bigint,
  'only one owned target is currently open'
);

select throws_ok(
  $$ select * from public.save_food_for_reuse(
    'Label-only snack', null, null, 1, 'pack', null, 180, false
  ) $$,
  '22023', 'explicit confirmation is required',
  'saved-food creation requires explicit confirmation'
);
insert into phase_3_ids (key, id)
select 'saved_food_a', food_product_id
from public.save_food_for_reuse(
  'Label-only snack', 'Fixture Brand', '4801234567890',
  1, 'pack', 45, 180, true
);
select results_eq(
  $$ select provider, macro_data_complete from public.food_products
     where id = (select id from phase_3_ids where key = 'saved_food_a') $$,
  $$ values ('user_manual'::text, false) $$,
  'private saved food preserves calories-only macro uncertainty'
);
select is(
  (select count(*) from public.food_products where user_id = '31111111-1111-4111-8111-111111111111'),
  1::bigint,
  'owner can list their private saved food'
);

set local "request.jwt.claims" =
  '{"sub":"32222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.food_products where id = (select id from phase_3_ids where key = 'saved_food_a')),
  0::bigint,
  'another user cannot list the private saved food'
);
select throws_ok(
  $$ select * from public.create_manual_food_log_preview(
    'snack', '2026-07-13 20:30:00+00', 'Asia/Manila', 'Cross-user product attempt',
    jsonb_build_array(jsonb_build_object(
      'food_product_id', (select id from phase_3_ids where key = 'saved_food_a'),
      'food_name', 'Forged', 'quantity', 1, 'unit', 'serving', 'calories', 1,
      'protein_g', 0, 'carbohydrates_g', 0, 'fat_g', 0
    ))
  ) $$,
  '22023', 'one or more manual preview items are invalid',
  'manual preview rejects another user private saved-food reference'
);

set local "request.jwt.claims" =
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into phase_3_ids (key, id)
select 'manual_preview_a', preview_id
from public.create_manual_food_log_preview(
  'dinner', '2026-07-13 20:30:00+00', 'Asia/Manila', 'Manual calories-only dinner',
  '[{"food_name":"Manual meal","quantity":1,"unit":"serving","calories":450}]'::jsonb
);
select results_eq(
  $$ select status, source_kind from public.chatgpt_log_previews
     where id = (select id from phase_3_ids where key = 'manual_preview_a') $$,
  $$ values ('ready'::text, 'manual'::text) $$,
  'manual RPC returns a ready first revision'
);
select is(
  (select count(*) from public.food_entries),
  0::bigint,
  'manual preview creates no permanent diary entry'
);
select ok(
  (select r.presented_at = p.last_presented_at
   from public.chatgpt_log_previews p
   join public.food_log_preview_revisions r
     on r.preview_id = p.id and r.revision_number = p.revision_number
   where p.id = (select id from phase_3_ids where key = 'manual_preview_a')),
  'the exact current manual revision is marked presented'
);
select results_eq(
  $$ select total_calories, macro_data_complete
     from public.food_log_preview_revisions
     where preview_id = (select id from phase_3_ids where key = 'manual_preview_a') $$,
  $$ values (450::numeric, false) $$,
  'manual totals are server-calculated and unknown macros stay incomplete'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_3_ids where key = 'manual_preview_a'), 1, false,
    'phase3-manual-false-01'
  ) $$,
  '22023', 'explicit confirmation is required',
  'false food confirmation writes nothing'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_3_ids where key = 'manual_preview_a'), 2, true,
    'phase3-manual-stale-01'
  ) $$,
  'P0001', 'stale preview revision',
  'stale manual revision is rejected'
);
insert into phase_3_ids (key, id)
select 'manual_entry_a', entry_id
from public.confirm_food_log(
  (select id from phase_3_ids where key = 'manual_preview_a'), 1, true,
  'phase3-manual-confirm-01'
);
select results_eq(
  $$ select reused, total_calories, total_protein_g
     from public.confirm_food_log(
       (select id from phase_3_ids where key = 'manual_preview_a'), 1, true,
       'phase3-manual-confirm-01'
     ) $$,
  $$ values (true, 450::numeric, null::numeric) $$,
  'exact retry reuses the calories-only confirmed entry'
);
select is(
  (select count(*) from public.food_entries where source_preview_id = (select id from phase_3_ids where key = 'manual_preview_a')),
  1::bigint,
  'confirmation and retry create exactly one entry'
);
select results_eq(
  $$ select calories, macro_data_complete from public.food_entry_items
     where food_entry_id = (select id from phase_3_ids where key = 'manual_entry_a') $$,
  $$ values (450::numeric, false) $$,
  'confirmed history snapshots incomplete manual nutrition honestly'
);
select results_eq(
  $$ select consumed_calories, macro_data_complete from public.daily_summaries
     where user_id = '31111111-1111-4111-8111-111111111111'
       and local_date = '2026-07-14' $$,
  $$ values (450::numeric, false) $$,
  'confirmation recalculates the Manila-local summary'
);

set local "request.jwt.claims" =
  '{"sub":"32222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.food_entries where id = (select id from phase_3_ids where key = 'manual_entry_a')),
  0::bigint,
  'another user cannot read the confirmed entry'
);
select throws_ok(
  $$ select * from public.delete_food_entry(
    (select id from phase_3_ids where key = 'manual_entry_a'), true
  ) $$,
  '42501', 'entry not found',
  'another user cannot delete the entry'
);

set local "request.jwt.claims" =
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select * from public.delete_food_entry(
    (select id from phase_3_ids where key = 'manual_entry_a'), false
  ) $$,
  '22023', 'explicit confirmation is required',
  'deletion requires explicit current confirmation'
);
select ok(
  (select deleted_at is not null from public.delete_food_entry(
    (select id from phase_3_ids where key = 'manual_entry_a'), true
  )),
  'explicit owner deletion soft-deletes the entry'
);
select results_eq(
  $$ select
       coalesce((select entry_count from public.daily_summaries
         where user_id = '31111111-1111-4111-8111-111111111111'
           and local_date = '2026-07-14'), 0),
       coalesce((select consumed_calories from public.daily_summaries
         where user_id = '31111111-1111-4111-8111-111111111111'
           and local_date = '2026-07-14'), 0) $$,
  $$ values (0, 0::numeric) $$,
  'deletion transactionally clears the affected historical summary'
);

select results_eq(
  $$ select reused, local_date, weight_kg from public.record_weight(
    '2026-07-13 20:00:00+00', 'Asia/Manila', 60.5, 'phase3-weight-shared-01'
  ) $$,
  $$ values (false, '2026-07-14'::date, 60.5::numeric) $$,
  'weight logging derives the owner and IANA local date'
);
select results_eq(
  $$ select reused, weight_kg from public.record_weight(
    '2026-07-13 20:00:00+00', 'Asia/Manila', 60.5, 'phase3-weight-shared-01'
  ) $$,
  $$ values (true, 60.5::numeric) $$,
  'identical weight retry is idempotent'
);

set local "request.jwt.claims" =
  '{"sub":"32222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.weight_logs where user_id = '31111111-1111-4111-8111-111111111111'),
  0::bigint,
  'another user cannot read the weight log'
);
select results_eq(
  $$ select reused, weight_kg from public.record_weight(
    '2026-07-13 20:00:00+00', 'Asia/Manila', 80, 'phase3-weight-shared-01'
  ) $$,
  $$ values (false, 80::numeric) $$,
  'idempotency keys are owner-scoped for weight writes'
);

set local "request.jwt.claims" =
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select * from public.confirm_food_log(
    '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, true,
    'phase3-chatgpt-no-client'
  ) $$,
  '42501', 'oauth client is not authorized for this action',
  'first-party token cannot confirm a ChatGPT preview'
);
set local "request.jwt.claims" =
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"unknown-phase3-client"}';
select throws_ok(
  $$ select * from public.confirm_food_log(
    '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, true,
    'phase3-chatgpt-unknown'
  ) $$,
  '42501', 'oauth client is not authorized for this action',
  'unknown OAuth client remains default-denied'
);

reset role;
insert into private.oauth_client_action_policies (
  client_id, action, enabled, approved_at, approved_by
) values ('phase3-reviewed-client', 'confirm_food_log', true, now(), 'pgTAP fixture');
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"phase3-reviewed-client"}';
select results_eq(
  $$ select reused, total_calories from public.confirm_food_log(
    '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, true,
    'phase3-chatgpt-allowed'
  ) $$,
  $$ values (false, 300::numeric) $$,
  'explicitly reviewed OAuth client/action can still confirm ChatGPT previews'
);
reset role;
select is(
  (select count(*) from private.oauth_client_action_policies),
  1::bigint,
  'first-party confirmation did not leave a permissive OAuth policy behind'
);
select is(
  (select count(*)::integer from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef),
  0,
  'all Phase 3 public RPCs remain security invoker wrappers'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_manual_food_log_preview(text,timestamp with time zone,text,text,jsonb)',
    'EXECUTE'
  ),
  'anon cannot execute manual preview creation'
);

select * from finish();
rollback;
