begin;

create extension if not exists pgtap with schema extensions;
select no_plan();
set constraints all deferred;

create temporary table fast_log_ids (key text primary key, id uuid not null);
grant all on table fast_log_ids to authenticated;

insert into auth.users (id, email) values
  ('71111111-1111-4111-8111-111111111111', 'fast-log-a@example.test'),
  ('72222222-2222-4222-8222-222222222222', 'fast-log-b@example.test');

select has_table('public', 'saved_meals', 'saved meals are persisted separately from diary entries');
select has_index('public', 'saved_meals', 'saved_meals_user_favorite_updated_idx', 'favorites have an owned recency index');
select has_index('public', 'saved_meals', 'saved_meals_source_entry_owner_idx', 'historical source ownership foreign key has a covering index');
select policies_are('public', 'saved_meals', array['saved_meals_select_own'], 'saved meals expose only the owner read policy');

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"71111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into fast_log_ids (key, id)
select 'source_preview', preview_id
from public.create_manual_food_log_preview(
  'breakfast', '2026-07-15 00:00:00+00', 'Asia/Manila',
  'Usual rice breakfast at home',
  '[{"food_name":"Steamed rice","quantity":1,"unit":"cup","serving_weight_g":158,"calories":205,"protein_g":4.3,"carbohydrates_g":44.5,"fat_g":0.4,"is_estimated":true,"confidence":0.8,"uncertainty":[{"code":"home_portion_estimate","message":"Usual home rice portion"}]}]'::jsonb
);
insert into fast_log_ids (key, id)
select 'source_entry', entry_id
from public.confirm_food_log(
  (select id from fast_log_ids where key = 'source_preview'), 1, true,
  'fast-log-source-confirm'
);

select results_eq(
  $$ select reused from public.save_food_entry_as_saved_meal(
    (select id from fast_log_ids where key = 'source_entry'),
    'Usual home rice', true, '73333333-3333-4333-8333-333333333333'
  ) $$,
  array[false],
  'saving a confirmed entry snapshots it once'
);
insert into fast_log_ids (key, id)
select 'saved_meal', id from public.saved_meals where name = 'Usual home rice';

select results_eq(
  $$ select reused from public.save_food_entry_as_saved_meal(
    (select id from fast_log_ids where key = 'source_entry'),
    'Usual home rice', true, '73333333-3333-4333-8333-333333333333'
  ) $$,
  array[true],
  'saved meal creation is idempotent'
);
select is(
  (select count(*) from public.saved_meals), 1::bigint,
  'an idempotent retry creates no duplicate saved meal'
);
select results_eq(
  $$ select is_favorite from public.set_saved_meal_favorite(
    (select id from fast_log_ids where key = 'saved_meal'), false
  ) $$,
  array[false],
  'favorites can be changed only through the owned RPC'
);

set local "request.jwt.claims" =
  '{"sub":"72222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*) from public.saved_meals), 0::bigint, 'another user cannot read saved meals');
select throws_ok(
  $$ select * from public.save_food_entry_as_saved_meal(
    (select id from fast_log_ids where key = 'source_entry'),
    'Stolen meal', true, '74444444-4444-4444-8444-444444444444'
  ) $$,
  '42501', 'active entry not found',
  'another user cannot save an owned history snapshot'
);

set local "request.jwt.claims" =
  '{"sub":"71111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into fast_log_ids (key, id)
select 'saved_preview', preview_id
from public.create_saved_meal_preview(
  (select id from fast_log_ids where key = 'saved_meal'),
  'breakfast', '2026-07-16 00:00:00+00'
);
select results_eq(
  $$ select status, total_calories from public.chatgpt_log_previews p
     join public.food_log_preview_revisions r
       on r.preview_id = p.id and r.revision_number = p.revision_number
     where p.id = (select id from fast_log_ids where key = 'saved_preview') $$,
  $$ values ('ready'::text, 205::numeric) $$,
  'a saved meal remains a complete presented preview'
);
select results_eq(
  $$ select provider from public.food_log_preview_items
     where preview_id = (select id from fast_log_ids where key = 'saved_preview') $$,
  array['saved_meal_snapshot_v1'::text],
  'saved meal preview preserves explicit snapshot provenance'
);
select ok(
  (select uncertainty @> '[{"code":"historical_portion_reuse"}]'::jsonb
   from public.food_log_preview_items
   where preview_id = (select id from fast_log_ids where key = 'saved_preview')),
  'saved meal preview warns that the historical portion must be reviewed'
);
select is(
  (select count(*) from public.food_entries where source_preview_id =
    (select id from fast_log_ids where key = 'saved_preview')), 0::bigint,
  'creating a saved meal preview does not write diary history'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from fast_log_ids where key = 'saved_preview'), 1, false,
    'fast-log-saved-false'
  ) $$,
  '22023', 'explicit confirmation is required',
  'a saved meal still requires explicit exact confirmation'
);
select * from public.confirm_food_log(
  (select id from fast_log_ids where key = 'saved_preview'), 1, true,
  'fast-log-saved-confirm'
);
select is(
  (select count(*) from public.food_entries where source_preview_id =
    (select id from fast_log_ids where key = 'saved_preview')), 1::bigint,
  'exact saved meal confirmation writes one entry'
);

insert into fast_log_ids (key, id)
select 'repeat_preview', preview_id
from public.create_repeat_meal_preview(
  'breakfast', '2026-07-17 00:00:00+00', '2026-07-15'
);
select is(
  (select source_local_date from public.create_repeat_meal_preview(
    'breakfast', '2026-07-18 00:00:00+00', '2026-07-15'
  ) limit 1),
  '2026-07-15'::date,
  'repeat breakfast reports the exact historical date used'
);
select ok(
  (select uncertainty @> '[{"code":"historical_portion_reuse"}]'::jsonb
   from public.food_log_preview_items
   where preview_id = (select id from fast_log_ids where key = 'repeat_preview')),
  'repeat breakfast surfaces historical-context uncertainty'
);
select results_eq(
  $$ select quantity, unit, last_meal_type, times_logged
     from public.get_quick_log_suggestions(20)
     where food_name = 'Steamed rice' $$,
  $$ values (1::numeric, 'cup'::text, 'breakfast'::text, 2::bigint) $$,
  'recent suggestions remember the last portion and meal with observed frequency'
);
select ok(
  (select provenance->>'kind' = 'confirmed_history'
   from public.get_quick_log_suggestions(20)
   where food_name = 'Steamed rice'),
  'recent suggestions identify confirmed-history provenance instead of certainty'
);

reset role;
select function_privs_are(
  'public', 'get_quick_log_suggestions', array['integer'],
  'authenticated', array['EXECUTE'],
  'authenticated clients can read owned historical suggestions'
);

select * from finish();
rollback;
