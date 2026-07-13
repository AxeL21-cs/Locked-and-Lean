begin;

create extension if not exists pgtap with schema extensions;
select plan(34);
set constraints all deferred;

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'phase2-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'phase2-b@example.test');

insert into private.oauth_client_action_policies (
  client_id,
  action,
  enabled,
  approved_at,
  approved_by
) values
  ('phase2-client-a', 'confirm_food_log', true, now(), 'pgTAP fixture'),
  ('phase2-client-b', 'confirm_food_log', true, now(), 'pgTAP fixture');

insert into public.profiles (user_id, display_name)
values
  ('11111111-1111-4111-8111-111111111111', 'User A'),
  ('22222222-2222-4222-8222-222222222222', 'User B');

insert into public.nutrition_targets (
  user_id,
  status,
  effective_from,
  calorie_target,
  protein_target_g,
  carbohydrate_target_g,
  fat_target_g,
  formula_name,
  formula_version,
  age_years,
  formula_sex,
  height_cm,
  weight_kg,
  activity_level,
  activity_multiplier,
  goal,
  goal_adjustment_kcal,
  macro_assumptions,
  informational_disclaimer_version
) values (
  '22222222-2222-4222-8222-222222222222',
  'confirmed',
  '2026-07-13',
  2000,
  120,
  250,
  70,
  'Mifflin-St Jeor',
  '1.0',
  30,
  'female',
  160,
  60,
  'moderate',
  1.55,
  'maintain',
  0,
  '{"protein_basis":"configured grams"}'::jsonb,
  '2026-07'
);

insert into public.food_products (
  id,
  user_id,
  canonical_name,
  serving_quantity,
  serving_unit,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  provider,
  provider_identifier
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'Private chicken meal',
    1,
    'serving',
    500,
    30,
    60,
    11,
    'fixture-provider-v1',
    'meal-a'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'User B private food',
    1,
    'serving',
    300,
    20,
    30,
    8,
    'fixture-provider-v1',
    'meal-b'
  );

insert into public.weight_logs (
  user_id,
  measured_at,
  local_date,
  time_zone,
  weight_kg
) values (
  '22222222-2222-4222-8222-222222222222',
  '2026-07-13 00:00:00+08',
  '2026-07-13',
  'Asia/Manila',
  60
);

insert into public.scan_sessions (id, user_id)
values (
  '22000000-0000-4000-8000-000000000022',
  '22222222-2222-4222-8222-222222222222'
);

insert into public.chatgpt_log_previews (
  id,
  user_id,
  source_kind,
  status,
  revision_number,
  last_presented_at,
  expires_at
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'chatgpt',
    'ready',
    1,
    '2026-07-12 12:00:00+00',
    now() + interval '1 hour'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '11111111-1111-4111-8111-111111111111',
    'chatgpt',
    'ready',
    2,
    '2026-07-12 12:05:00+00',
    now() + interval '1 hour'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '22222222-2222-4222-8222-222222222222',
    'chatgpt',
    'ready',
    1,
    '2026-07-12 12:10:00+00',
    now() + interval '1 hour'
  );

insert into public.food_log_preview_revisions (
  preview_id,
  revision_number,
  user_id,
  meal_type,
  consumed_at,
  time_zone,
  original_description,
  total_calories,
  total_protein_g,
  total_carbohydrates_g,
  total_fat_g,
  presented_at
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    1,
    '11111111-1111-4111-8111-111111111111',
    'dinner',
    '2026-07-12 23:30:00+00',
    'Asia/Manila',
    'Chicken meal with rice',
    999,
    999,
    999,
    999,
    '2026-07-12 12:00:00+00'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    1,
    '11111111-1111-4111-8111-111111111111',
    'lunch',
    '2026-07-12 04:00:00+00',
    'Asia/Manila',
    'Old revision',
    100,
    1,
    1,
    1,
    '2026-07-12 12:04:00+00'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    2,
    '11111111-1111-4111-8111-111111111111',
    'lunch',
    '2026-07-12 04:00:00+00',
    'Asia/Manila',
    'Current revision',
    200,
    2,
    2,
    2,
    '2026-07-12 12:05:00+00'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    1,
    '22222222-2222-4222-8222-222222222222',
    'dinner',
    '2026-07-12 23:30:00+00',
    'Asia/Manila',
    'User B meal',
    300,
    20,
    30,
    8,
    '2026-07-12 12:10:00+00'
  );

insert into public.food_log_preview_items (
  id,
  preview_id,
  revision_number,
  user_id,
  ordinal,
  parent_preview_item_id,
  component_role,
  food_product_id,
  food_name,
  quantity,
  unit,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  provider,
  provider_identifier,
  is_estimated,
  confidence,
  uncertainty
) values
  (
    'a0000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    1,
    '11111111-1111-4111-8111-111111111111',
    1,
    null,
    'meal',
    '10000000-0000-4000-8000-000000000001',
    'Chicken rice meal',
    1,
    'meal',
    0,
    0,
    0,
    0,
    'fixture-provider-v1',
    'meal-a',
    false,
    1,
    '[]'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    1,
    '11111111-1111-4111-8111-111111111111',
    2,
    'a0000000-0000-4000-8000-000000000001',
    'rice',
    '10000000-0000-4000-8000-000000000001',
    'Steamed rice',
    1,
    'cup',
    250,
    5,
    55,
    1,
    'fixture-provider-v1',
    'rice-a',
    false,
    1,
    '[]'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    1,
    '11111111-1111-4111-8111-111111111111',
    3,
    'a0000000-0000-4000-8000-000000000001',
    'main_dish',
    '10000000-0000-4000-8000-000000000001',
    'Chicken',
    1,
    'piece',
    250,
    25,
    5,
    10,
    'fixture-provider-v1',
    'chicken-a',
    true,
    0.7,
    '["oil amount unknown"]'::jsonb
  ),
  (
    'c0000000-0000-4000-8000-000000000001',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    1,
    '22222222-2222-4222-8222-222222222222',
    1,
    null,
    'standalone',
    '20000000-0000-4000-8000-000000000002',
    'User B private food',
    1,
    'serving',
    300,
    20,
    30,
    8,
    'fixture-provider-v1',
    'meal-b',
    false,
    1,
    '[]'::jsonb
  );

select throws_ok(
  $$
    insert into public.food_log_preview_items (
      preview_id, revision_number, user_id, ordinal, food_name, quantity, unit,
      calories, protein_g, carbohydrates_g, fat_g, provider, is_estimated, uncertainty
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2,
      '11111111-1111-4111-8111-111111111111', 99, 'Invalid nutrition', 1, 'serving',
      -1, 0, 0, 0, 'fixture', false, '[]'::jsonb
    )
  $$,
  '23514'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","client_id":"phase2-client-b"}';

select results_eq(
  $$
    select reused, total_calories
    from public.confirm_food_log(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 1, true, 'phase2-b-confirm-0001'
    )
  $$,
  $$ values (false, 300::numeric) $$,
  'explicitly enabled OAuth client/action can confirm its current revision'
);

set local "request.jwt.claims" =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"phase2-client-a"}';

select is((select count(*) from public.profiles where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B profile');
select is((select count(*) from public.nutrition_targets where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B targets');
select is((select count(*) from public.food_products where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B private foods');
select is((select count(*) from public.food_entries where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B entries');
select is((select count(*) from public.food_entry_items where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B entry items');
select is((select count(*) from public.weight_logs where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B weights');
select is((select count(*) from public.daily_summaries where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B summaries');
select is((select count(*) from public.scan_sessions where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B scan sessions');
select is((select count(*) from public.chatgpt_log_previews where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B previews');
select is((select count(*) from public.food_log_preview_revisions where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B preview revisions');
select is((select count(*) from public.food_log_preview_items where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B preview items');
select is((select count(*) from public.mcp_idempotency_keys where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B idempotency results');
select is((select count(*) from public.oauth_action_audit where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'A cannot read B audit rows');

select throws_ok(
  $$
    select * from public.confirm_food_log(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 1, true, 'phase2-cross-user-0001'
    )
  $$,
  '42501',
  'preview not found',
  'cross-user preview confirmation is denied without revealing the owner'
);

select throws_ok(
  $$
    select * from public.confirm_food_log(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1, true, 'phase2-stale-rev-0001'
    )
  $$,
  'P0001',
  'stale preview revision',
  'stale revisions are rejected'
);

select throws_ok(
  $$
    select * from public.confirm_food_log(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, false, 'phase2-not-confirmed-01'
    )
  $$,
  '22023',
  'explicit confirmation is required',
  'ambiguous or false confirmation cannot write'
);

set local "request.jwt.claims" =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $$
    select * from public.confirm_food_log(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, true, 'phase2-no-client-0001'
    )
  $$,
  '42501',
  'oauth client is not authorized for this action',
  'missing OAuth client_id is denied by default'
);

set local "request.jwt.claims" =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"unknown-client"}';

select throws_ok(
  $$
    select * from public.confirm_food_log(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, true, 'phase2-unknown-client'
    )
  $$,
  '42501',
  'oauth client is not authorized for this action',
  'unknown OAuth client/action is denied by default'
);

set local "request.jwt.claims" =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"phase2-client-a"}';

select results_eq(
  $$
    select reused, local_date, total_calories, total_protein_g, total_carbohydrates_g, total_fat_g
    from public.confirm_food_log(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, true, 'phase2-a-confirm-0001'
    )
  $$,
  $$ values (false, '2026-07-13'::date, 500::numeric, 30::numeric, 60::numeric, 11::numeric) $$,
  'confirmation derives Manila date and totals from current preview items, not preview totals'
);

select results_eq(
  $$
    select reused, total_calories
    from public.confirm_food_log(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, true, 'phase2-a-confirm-0001'
    )
  $$,
  $$ values (true, 500::numeric) $$,
  'same idempotency key and request returns the original entry'
);

select throws_ok(
  $$
    select * from public.confirm_food_log(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2, true, 'phase2-a-confirm-0001'
    )
  $$,
  '23505',
  'idempotency key reused with different request',
  'same key with a different request conflicts'
);

select is((select count(*) from public.food_entries where user_id = '11111111-1111-4111-8111-111111111111'), 1::bigint, 'retry created exactly one A entry');
select is((select count(*) from public.mcp_idempotency_keys where user_id = '11111111-1111-4111-8111-111111111111'), 1::bigint, 'failed attempts did not leave idempotency rows');
select is((select consumed_calories from public.daily_summaries where user_id = '11111111-1111-4111-8111-111111111111' and local_date = '2026-07-13'), 500::numeric, 'confirmation recalculated the daily summary atomically');
select is((select count(*) from public.food_entry_items where user_id = '11111111-1111-4111-8111-111111111111' and provider = 'fixture-provider-v1'), 3::bigint, 'historical items snapshot their provider values');
select is((select count(*) from public.food_entry_items where user_id = '11111111-1111-4111-8111-111111111111' and component_role in ('main_dish', 'rice') and parent_entry_item_id is not null and parent_entry_item_id = parent_source_preview_item_id), 2::bigint, 'canonical component roles and parent linkage survive confirmation');
select is(
  (
    select count(*)
    from public.food_entry_items as child
    join public.food_entry_items as parent
      on parent.id = child.parent_entry_item_id
      and parent.food_entry_id = child.food_entry_id
      and parent.user_id = child.user_id
    join public.food_log_preview_items as source_child
      on source_child.id = child.source_preview_item_id
    where child.user_id = '11111111-1111-4111-8111-111111111111'
      and source_child.parent_preview_item_id = child.parent_source_preview_item_id
      and parent.source_preview_item_id = source_child.parent_preview_item_id
  ),
  2::bigint,
  'confirmed children retain both entry-parent and immutable preview-parent lineage'
);

reset role;

update public.food_products
set provider = 'fixture-provider-v2', calories = 900
where id = '10000000-0000-4000-8000-000000000001';

select is((select count(*) from public.food_entry_items where user_id = '11111111-1111-4111-8111-111111111111' and provider = 'fixture-provider-v1'), 3::bigint, 'provider changes do not rewrite historical item snapshots');

update public.food_entry_items
set calories = 350
where id = 'a0000000-0000-4000-8000-000000000002';

select is((select total_calories from public.food_entries where user_id = '11111111-1111-4111-8111-111111111111'), 600::numeric, 'entry totals recalculate after item changes');
select is((select consumed_calories from public.daily_summaries where user_id = '11111111-1111-4111-8111-111111111111' and local_date = '2026-07-13'), 600::numeric, 'daily summary recalculates after item changes');
select is((select count(*) from public.oauth_action_audit where user_id = '11111111-1111-4111-8111-111111111111' and idempotency_outcome = 'created'), 1::bigint, 'initial confirmation records one created audit event');
select is((select count(*) from public.oauth_action_audit where user_id = '11111111-1111-4111-8111-111111111111' and idempotency_outcome = 'reused'), 1::bigint, 'safe retry records one minimal reused audit event');

select * from finish();
rollback;
