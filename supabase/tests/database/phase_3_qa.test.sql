begin;

create extension if not exists pgtap with schema extensions;
select plan(37);
set constraints all deferred;

-- Distinct QA fixtures; this suite does not depend on Phase 2 test state.
insert into auth.users (id, email)
values
  ('31313131-3131-4131-8131-313131313131', 'phase3-qa-a@example.test'),
  ('32323232-3232-4232-8232-323232323232', 'phase3-qa-b@example.test');

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"31313131-3131-4131-8131-313131313131","role":"authenticated"}';

-- 1: personalized onboarding is adult-only.
select throws_ok(
  $$
    select * from public.upsert_profile(
      'QA User A', '2010-01-01', 'female', 160, 'metric', 'Asia/Manila'
    )
  $$,
  '22023',
  'personalized targets require an adult aged 18 to 120',
  'under-18 onboarding is rejected server-side'
);

-- 2: create an adult first-party profile for cross-user checks.
select results_eq(
  $$
    select user_id, display_name from public.upsert_profile(
      'QA User A', '1995-01-01', 'female', 160, 'metric', 'Asia/Manila'
    )
  $$,
  $$ values ('31313131-3131-4131-8131-313131313131'::uuid, 'QA User A'::text) $$,
  'profile identity comes from auth.uid'
);

set local "request.jwt.claims" =
  '{"sub":"32323232-3232-4232-8232-323232323232","role":"authenticated"}';

-- 3: user B receives an independent first-party profile.
select results_eq(
  $$
    select user_id, display_name from public.upsert_profile(
      'QA User B', '1990-01-01', 'male', 175, 'metric', 'Asia/Manila'
    )
  $$,
  $$ values ('32323232-3232-4232-8232-323232323232'::uuid, 'QA User B'::text) $$,
  'second profile is owner-bound'
);

-- 4-9: a calculation is only a proposal until exact explicit confirmation.
select results_eq(
  $$
    select status from public.propose_nutrition_target(
      72, 'moderately_active', 'maintain', 0, null
    )
  $$,
  $$ values ('proposed'::text) $$,
  'target calculation creates a proposal'
);

select is(
  (select count(*) from public.nutrition_targets where status = 'confirmed'),
  0::bigint,
  'proposal does not silently become an active target'
);

select throws_ok(
  $$
    select * from public.confirm_nutrition_target(
      (select id from public.nutrition_targets where status = 'proposed'), false
    )
  $$,
  '22023',
  'explicit confirmation is required',
  'ambiguous target confirmation is rejected'
);

select is(
  (select count(*) from public.nutrition_targets where status = 'proposed'),
  1::bigint,
  'failed confirmation leaves the proposal unactivated'
);

select results_eq(
  $$
    select status from public.confirm_nutrition_target(
      (select id from public.nutrition_targets where status = 'proposed'), true
    )
  $$,
  $$ values ('confirmed'::text) $$,
  'explicit confirmation activates the proposed target'
);

select ok(
  (select onboarding_completed_at is not null from public.profiles),
  'confirmed target completes onboarding'
);

-- 10-13: weight writes are request-bound and cannot silently revise targets.
select results_eq(
  $$
    select reused, weight_kg from public.record_weight(
      now(), 'Asia/Manila', 73, 'phase3-qa-weight-0001'
    )
  $$,
  $$ values (false, 73::numeric) $$,
  'first weight request creates one record'
);

select results_eq(
  $$
    select reused, weight_kg from public.record_weight(
      now(), 'Asia/Manila', 73, 'phase3-qa-weight-0001'
    )
  $$,
  $$ values (true, 73::numeric) $$,
  'identical weight retry reuses the record'
);

select throws_ok(
  $$
    select * from public.record_weight(
      now(), 'Asia/Manila', 74, 'phase3-qa-weight-0001'
    )
  $$,
  '23505',
  'idempotency key reused with different request',
  'conflicting weight retry is rejected'
);

select is(
  (select weight_kg from public.nutrition_targets where status = 'confirmed'),
  72::numeric,
  'weight logging does not silently recalculate a confirmed target'
);

-- 14-15: saved foods are private, explicit-confirmation writes.
select throws_ok(
  $$
    select * from public.save_food_for_reuse(
      'QA arroz caldo', null, null, 1, 'bowl', null, 365, false,
      null, null, null
    )
  $$,
  '22023',
  'explicit confirmation is required',
  'saved food requires explicit confirmation'
);

select results_eq(
  $$
    select canonical_name, calories, macro_data_complete
    from public.save_food_for_reuse(
      'QA arroz caldo', null, null, 1, 'bowl', null, 365, true,
      null, null, null
    )
  $$,
  $$ values ('QA arroz caldo'::text, 365::numeric, false) $$,
  'confirmed calories-only food preserves unknown macros'
);

-- 16-22: manual food is a presented preview until exact confirmation.
select results_eq(
  $$
    select status, total_calories, macro_data_complete
    from public.create_manual_food_log_preview(
      'breakfast', now(), 'Asia/Manila', 'QA manual arroz caldo',
      '[{"food_name":"QA arroz caldo","quantity":1,"unit":"bowl","calories":365,"provider":"qa_manual_fixture"}]'::jsonb
    )
  $$,
  $$ values ('ready'::text, 365::numeric, false) $$,
  'manual input becomes a complete current preview'
);

select is(
  (select count(*) from public.food_entries),
  0::bigint,
  'manual preview is absent from the permanent diary'
);

select throws_ok(
  $$
    select * from public.confirm_food_log(
      (select id from public.chatgpt_log_previews where source_kind = 'manual'),
      1, false, 'phase3-qa-manual-0001'
    )
  $$,
  '22023',
  'explicit confirmation is required',
  'manual preview rejects false confirmation'
);

select is(
  (select count(*) from public.food_entries),
  0::bigint,
  'failed confirmation leaves the diary unchanged'
);

select results_eq(
  $$
    select reused, total_calories from public.confirm_food_log(
      (select id from public.chatgpt_log_previews where source_kind = 'manual'),
      1, true, 'phase3-qa-manual-0001'
    )
  $$,
  $$ values (false, 365::numeric) $$,
  'explicit current-revision confirmation creates the manual entry'
);

select results_eq(
  $$
    select reused, total_calories from public.confirm_food_log(
      (select id from public.chatgpt_log_previews where source_kind = 'manual'),
      1, true, 'phase3-qa-manual-0001'
    )
  $$,
  $$ values (true, 365::numeric) $$,
  'manual confirmation retry safely reuses the entry'
);

select is(
  (select count(*) from public.food_entries),
  1::bigint,
  'confirmation retry creates exactly one permanent entry'
);

-- 23-26: deletion is explicit, owner-scoped, and summary-safe.
select throws_ok(
  $$
    select * from public.delete_food_entry(
      (select id from public.food_entries where source_kind = 'manual'), false
    )
  $$,
  '22023',
  'explicit confirmation is required',
  'entry deletion rejects false confirmation'
);

select ok(
  (select deleted_at is null from public.food_entries where source_kind = 'manual'),
  'failed deletion keeps the entry active'
);

select ok(
  (
    select deleted_at is not null from public.delete_food_entry(
      (select id from public.food_entries where source_kind = 'manual'), true
    )
  ),
  'explicit deletion soft-deletes the owned entry'
);

select is(
  (
    select entry_count from public.daily_summaries
    where local_date = (now() at time zone 'Asia/Manila')::date
  ),
  0,
  'deletion atomically removes the entry from the daily count'
);

reset role;

-- A real ChatGPT-source fixture remains on the Phase 2 OAuth path.
insert into public.chatgpt_log_previews (
  id, user_id, source_kind, status, revision_number, last_presented_at, expires_at
) values (
  '33333333-3333-4333-8333-333333333333',
  '32323232-3232-4232-8232-323232323232',
  'chatgpt', 'ready', 1, now(), now() + interval '1 hour'
);

insert into public.food_log_preview_revisions (
  preview_id, revision_number, user_id, meal_type, consumed_at, time_zone,
  original_description, total_calories, total_protein_g,
  total_carbohydrates_g, total_fat_g, presented_at
) values (
  '33333333-3333-4333-8333-333333333333', 1,
  '32323232-3232-4232-8232-323232323232', 'lunch', now(),
  'Asia/Manila', 'QA ChatGPT preview', 200, 10, 25, 6, now()
);

update public.chatgpt_log_previews
set last_presented_at = (
  select presented_at from public.food_log_preview_revisions
  where preview_id = '33333333-3333-4333-8333-333333333333'
)
where id = '33333333-3333-4333-8333-333333333333';

insert into public.food_log_preview_items (
  id, preview_id, revision_number, user_id, ordinal, component_role,
  food_name, quantity, unit, calories, protein_g, carbohydrates_g, fat_g,
  provider, is_estimated, confidence, uncertainty
) values (
  '34343434-3434-4434-8434-343434343434',
  '33333333-3333-4333-8333-333333333333', 1,
  '32323232-3232-4232-8232-323232323232', 1, 'standalone',
  'QA ChatGPT meal', 1, 'serving', 200, 10, 25, 6,
  'qa_chatgpt_fixture', true, 0.7, '["portion uncertain"]'::jsonb
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"32323232-3232-4232-8232-323232323232","role":"authenticated"}';

-- 27: first-party allowance is limited to native preview sources.
select throws_ok(
  $$
    select * from public.confirm_food_log(
      '33333333-3333-4333-8333-333333333333', 1, true,
      'phase3-qa-chatgpt-0001'
    )
  $$,
  '42501',
  'oauth client is not authorized for this action',
  'ChatGPT preview cannot use the first-party confirmation branch'
);

reset role;

insert into private.oauth_client_action_policies (
  client_id, action, enabled, approved_at, approved_by
) values (
  'phase3-qa-chatgpt-client', 'confirm_food_log', true, now(), 'pgTAP QA fixture'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"32323232-3232-4232-8232-323232323232","role":"authenticated","client_id":"phase3-qa-chatgpt-client"}';

-- 28-29: approved OAuth action still confirms exactly once.
select results_eq(
  $$
    select reused, total_calories from public.confirm_food_log(
      '33333333-3333-4333-8333-333333333333', 1, true,
      'phase3-qa-chatgpt-0001'
    )
  $$,
  $$ values (false, 200::numeric) $$,
  'approved ChatGPT OAuth client confirms the presented revision'
);

select is(
  (select count(*) from public.food_entries where deleted_at is null),
  1::bigint,
  'OAuth confirmation creates one active ChatGPT entry'
);

reset role;

select set_config(
  'locked_and_lean.qa_b_entry_id',
  (
    select confirmed_entry_id::text from public.chatgpt_log_previews
    where id = '33333333-3333-4333-8333-333333333333'
  ),
  true
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"31313131-3131-4131-8131-313131313131","role":"authenticated"}';

-- 30-37: User A cannot read or mutate User B's Phase 3 data.
select is(
  (select count(*) from public.profiles where user_id = '32323232-3232-4232-8232-323232323232'),
  0::bigint,
  'A cannot read B profile'
);

select is(
  (select count(*) from public.nutrition_targets where user_id = '32323232-3232-4232-8232-323232323232'),
  0::bigint,
  'A cannot read B target or proposal history'
);

select is(
  (select count(*) from public.weight_logs where user_id = '32323232-3232-4232-8232-323232323232'),
  0::bigint,
  'A cannot read B weights'
);

select is(
  (select count(*) from public.food_products where user_id = '32323232-3232-4232-8232-323232323232'),
  0::bigint,
  'A cannot read B saved foods'
);

select is(
  (select count(*) from public.food_entries where user_id = '32323232-3232-4232-8232-323232323232'),
  0::bigint,
  'A cannot read B diary entries'
);

select is(
  (select count(*) from public.daily_summaries where user_id = '32323232-3232-4232-8232-323232323232'),
  0::bigint,
  'A cannot read B daily summaries'
);

select is(
  (select count(*) from public.chatgpt_log_previews where user_id = '32323232-3232-4232-8232-323232323232'),
  0::bigint,
  'A cannot read B manual or ChatGPT previews'
);

select throws_ok(
  $$
    select * from public.delete_food_entry(
      current_setting('locked_and_lean.qa_b_entry_id')::uuid, true
    )
  $$,
  '42501',
  'entry not found',
  'A cannot delete B entry or learn whether it exists'
);

select * from finish();
rollback;
