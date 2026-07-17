begin;

create extension if not exists pgtap with schema extensions;
select plan(59);
set constraints all deferred;

create temporary table phase_5_ids (
  key text primary key,
  id uuid not null
);
grant all on table phase_5_ids to authenticated;

insert into auth.users (id, email)
values
  ('51111111-1111-4111-8111-111111111111', 'phase5-a@example.test'),
  ('52222222-2222-4222-8222-222222222222', 'phase5-b@example.test');

insert into public.nutrition_targets (
  id, user_id, status, effective_from, calorie_target, protein_target_g,
  carbohydrate_target_g, fat_target_g, formula_name, formula_version,
  age_years, formula_sex, height_cm, weight_kg, activity_level,
  activity_multiplier, goal, goal_adjustment_kcal, macro_assumptions,
  informational_disclaimer_version
) values (
  '5a111111-1111-4111-8111-111111111111',
  '51111111-1111-4111-8111-111111111111', 'confirmed', '2026-07-01',
  1800, 100, 220, 60, 'phase5_fixture', 'phase5_fixture_v1',
  36, 'female', 160, 60, 'sedentary', 1.2, 'maintain', 0,
  '{"fixture":true}'::jsonb, 'phase5-fixture-v1'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into phase_5_ids (key, id)
select 'preview_a_1', preview_id
from public.create_manual_food_log_preview(
  'breakfast', '2026-07-01 15:59:59+00', 'Asia/Manila',
  'Complete Manila July 1 entry',
  '[{"food_name":"Snapshot meal A1","quantity":1,"unit":"serving","calories":100,"protein_g":10,"carbohydrates_g":15,"fat_g":2,"is_estimated":false,"confidence":0.9,"uncertainty":[]}]'::jsonb
);
insert into phase_5_ids (key, id)
select 'entry_a_1', entry_id
from public.confirm_food_log(
  (select id from phase_5_ids where key = 'preview_a_1'), 1, true,
  'phase5-entry-a1-confirm'
);

insert into phase_5_ids (key, id)
select 'preview_a_2', preview_id
from public.create_manual_food_log_preview(
  'snack', '2026-07-01 16:00:00+00', 'Asia/Manila',
  'Incomplete Manila July 2 entry',
  '[{"food_name":"Snapshot meal A2","quantity":1,"unit":"serving","calories":200,"uncertainty":["macros unavailable"]}]'::jsonb
);
insert into phase_5_ids (key, id)
select 'entry_a_2', entry_id
from public.confirm_food_log(
  (select id from phase_5_ids where key = 'preview_a_2'), 1, true,
  'phase5-entry-a2-confirm'
);

select * from public.record_weight(
  '2026-06-30 15:00:00+00', 'Asia/Manila', 71, 'phase5-weight-a-000'
);
insert into phase_5_ids (key, id)
select 'weight_a_1', weight_log_id
from public.record_weight(
  '2026-07-01 16:00:00+00', 'Asia/Manila', 70, 'phase5-weight-a-001'
);
select * from public.record_weight(
  '2026-07-03 16:00:00+00', 'Asia/Manila', 69, 'phase5-weight-a-002'
);

set local "request.jwt.claims" =
  '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated"}';
insert into phase_5_ids (key, id)
select 'preview_b_1', preview_id
from public.create_manual_food_log_preview(
  'lunch', '2026-07-01 16:30:00+00', 'Asia/Manila',
  'User B Manila July 2 entry',
  '[{"food_name":"Other user meal","quantity":1,"unit":"serving","calories":999,"protein_g":99,"carbohydrates_g":99,"fat_g":99}]'::jsonb
);
insert into phase_5_ids (key, id)
select 'entry_b_1', entry_id
from public.confirm_food_log(
  (select id from phase_5_ids where key = 'preview_b_1'), 1, true,
  'phase5-entry-b1-confirm'
);

reset role;
-- Simulate legacy drift: Phase 5 reads must derive from instants, never these
-- stored local_date values.
update public.food_entries
set local_date = '2026-07-01'
where id = (select id from phase_5_ids where key = 'entry_a_2');
update public.weight_logs
set local_date = '2026-07-01'
where id = (select id from phase_5_ids where key = 'weight_a_1');

select throws_ok(
  $$ select private.local_date_for_zone(now(), 'UTC') $$,
  '22023',
  'timezone must be Asia/Manila for Philippine diary dates',
  'future diary dates cannot choose a non-Manila timezone'
);
select has_index(
  'public', 'food_entries', 'food_entries_user_manila_history_cover_idx',
  'active Manila history reads have a matching partial covering index'
);
select has_index(
  'public', 'weight_logs', 'weight_logs_user_manila_date_idx',
  'Manila weight reads have a matching expression index'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $$ select * from public.get_calendar_history('2026-01-01', '2026-03-04') $$,
  '22023', 'date range must not exceed 62 days',
  'calendar ranges are bounded to 62 Manila dates'
);
select throws_ok(
  $$ select * from public.get_progress_summary('2025-01-01', '2026-01-02') $$,
  '22023', 'date range must not exceed 366 days',
  'progress ranges are bounded to 366 Manila dates'
);

set local "request.jwt.claims" =
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"unknown-phase5-client"}';
select throws_ok(
  $$ select * from public.get_calendar_history('2026-07-01', '2026-07-03') $$,
  '42501', 'oauth client is not authorized for this history action',
  'unknown OAuth clients are default-denied for history reads'
);

set local "request.jwt.claims" =
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  (select count(*) from public.get_calendar_history('2026-07-01', '2026-07-03')),
  3::bigint,
  'calendar returns every requested Manila date including empty days'
);
select results_eq(
  $$ select entry_count, consumed_calories, consumed_protein_g,
            macro_data_complete, has_entries
     from public.get_calendar_history('2026-07-01', '2026-07-03')
     where local_date = '2026-07-01' $$,
  $$ values (1, 100::numeric, 10::numeric, true, true) $$,
  'the instant before UTC 16:00 belongs to Manila July 1'
);
select results_eq(
  $$ select entry_count, consumed_calories, consumed_protein_g,
            macro_data_complete, has_entries
     from public.get_calendar_history('2026-07-01', '2026-07-03')
     where local_date = '2026-07-02' $$,
  $$ values (1, 200::numeric, null::numeric, false, true) $$,
  'UTC 16:00 crosses to Manila July 2 and incomplete macros remain null'
);
select results_eq(
  $$ select entry_count, consumed_calories, consumed_protein_g,
            macro_data_complete, has_entries
     from public.get_calendar_history('2026-07-01', '2026-07-03')
     where local_date = '2026-07-03' $$,
  $$ values (0, 0::numeric, 0::numeric, true, false) $$,
  'empty dates are explicitly no-record days, not logged zero-macro days'
);
select is(
  (select count(*) from public.get_calendar_history('2026-07-01', '2026-07-03')
   where manila_time_zone = 'Asia/Manila'),
  3::bigint,
  'every calendar row names the server date authority'
);
select ok(
  (select calorie_target is not null
   from public.get_calendar_history('2026-07-01', '2026-07-03')
   where local_date = '2026-07-02'),
  'calendar resolves the confirmed target effective on each Manila date'
);
select is(
  (select weight_kg from public.get_calendar_history('2026-07-01', '2026-07-03')
   where local_date = '2026-07-02'),
  70::numeric,
  'same-day weight is derived from measured_at despite legacy stored-date drift'
);
select is(
  (select local_date from public.food_entries
   where id = (select id from phase_5_ids where key = 'entry_a_2')),
  '2026-07-01'::date,
  'the test fixture proves the stored legacy date differs from Manila history'
);

select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2026-07-02', '2026-07-02') $$,
  $$ values (1, 200::numeric) $$,
  'calendar ignores a mismatched stored date and derives July 2 from the instant'
);
select is(
  (select count(*) from public.get_day_history('2026-07-02')),
  1::bigint,
  'day history returns only the owner active entry for the Manila date'
);
select is(
  (select local_date from public.get_day_history('2026-07-02')),
  '2026-07-02'::date,
  'day history returns the derived Manila local date'
);
select is(
  (select jsonb_array_length(items) from public.get_day_history('2026-07-02')),
  1,
  'day history includes a complete ordered immutable item snapshot'
);
select is(
  (select items -> 0 ->> 'provider' from public.get_day_history('2026-07-02')),
  'manual_user_input_v1'::text,
  'day history reads snapshotted provenance without a live provider join'
);
select is(
  (select (items -> 0 ->> 'macro_data_complete')::boolean
   from public.get_day_history('2026-07-02')),
  false,
  'day item snapshot exposes unknown macros honestly'
);

set local "request.jwt.claims" =
  '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated"}';
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2026-07-02', '2026-07-02') $$,
  $$ values (1, 999::numeric) $$,
  'another user sees only their own Manila summary'
);
select is(
  (select count(*) from public.get_day_history('2026-07-02')
   where entry_id = (select id from phase_5_ids where key = 'entry_a_2')),
  0::bigint,
  'another user cannot read owner A immutable entries'
);

set local "request.jwt.claims" =
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  (select count(*) from public.get_weight_trend('2026-07-01', '2026-07-04')),
  2::bigint,
  'weight trend returns sparse points in the requested Manila range'
);
select results_eq(
  $$ select local_date, weight_kg, previous_weight_kg,
            change_from_previous_kg, days_since_previous
     from public.get_weight_trend('2026-07-01', '2026-07-04')
     order by measured_at limit 1 $$,
  $$ values ('2026-07-02'::date, 70::numeric, 71::numeric, -1::numeric, 2) $$,
  'first in-range weight compares with the prior Manila point'
);
select results_eq(
  $$ select local_date, weight_kg, previous_weight_kg,
            change_from_previous_kg, days_since_previous
     from public.get_weight_trend('2026-07-01', '2026-07-04')
     order by measured_at desc limit 1 $$,
  $$ values ('2026-07-04'::date, 69::numeric, 70::numeric, -1::numeric, 2) $$,
  'weight gaps and changes use derived Manila dates consistently'
);
select results_eq(
  $$ select logged_days, total_entries, average_daily_calories,
            complete_macro_days, average_daily_protein_g
     from public.get_progress_summary('2026-07-01', '2026-07-04') $$,
  $$ values (2, 2, 150::numeric, 1, 10::numeric) $$,
  'initial progress averages logged days and excludes incomplete macros from macro averages'
);
select results_eq(
  $$ select first_weight_date, first_weight_kg, latest_weight_date,
            latest_weight_kg, weight_change_kg
     from public.get_progress_summary('2026-07-01', '2026-07-04') $$,
  $$ values ('2026-07-02'::date, 70::numeric, '2026-07-04'::date,
             69::numeric, -1::numeric) $$,
  'progress summarizes sparse Manila weight change without interpolation'
);
select ok(
  (select calorie_target is not null
   from public.get_progress_summary('2026-07-01', '2026-07-04')),
  'progress returns the confirmed target effective on the range end date'
);

set local "request.jwt.claims" =
  '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select * from public.copy_food_entry_to_preview(
    (select id from phase_5_ids where key = 'entry_a_1'),
    'breakfast', '2026-07-02 16:00:00+00'
  ) $$,
  '42501', 'active entry not found',
  'another user cannot copy an owner entry'
);

set local "request.jwt.claims" =
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into phase_5_ids (key, id)
select 'copy_preview', preview_id
from public.copy_food_entry_to_preview(
  (select id from phase_5_ids where key = 'entry_a_1'),
  'breakfast', '2026-07-02 16:00:00+00'
);
select results_eq(
  $$ select status, history_intent, total_calories, time_zone,
            jsonb_array_length(items)
     from public.copy_food_entry_to_preview(
       (select id from phase_5_ids where key = 'entry_a_1'),
       'breakfast', '2026-07-02 16:30:00+00'
     ) $$,
  $$ values ('ready'::text, 'copy'::text, 100::numeric,
             'Asia/Manila'::text, 1) $$,
  'copy returns a complete self-contained presented preview'
);
select is(
  (select count(*) from public.food_entries where user_id = '51111111-1111-4111-8111-111111111111'),
  2::bigint,
  'copy preview creation writes no permanent entry'
);
select is(
  (select items -> 0 ->> 'provider'
   from public.copy_food_entry_to_preview(
     (select id from phase_5_ids where key = 'entry_a_1'),
     'breakfast', '2026-07-02 17:00:00+00'
   )),
  'manual_user_input_v1'::text,
  'copy preview preserves immutable provider provenance'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_5_ids where key = 'copy_preview'), 1, false,
    'phase5-copy-false-01'
  ) $$,
  '22023', 'explicit confirmation is required',
  'copy remains preview-only without explicit confirmation'
);
insert into phase_5_ids (key, id)
select 'copy_entry', entry_id
from public.confirm_food_log(
  (select id from phase_5_ids where key = 'copy_preview'), 1, true,
  'phase5-copy-confirm-01'
);
select results_eq(
  $$ select reused, total_calories from public.confirm_food_log(
    (select id from phase_5_ids where key = 'copy_preview'), 1, true,
    'phase5-copy-confirm-01'
  ) $$,
  $$ values (true, 100::numeric) $$,
  'copy confirmation retry is exactly once'
);
select ok(
  (select deleted_at is null from public.food_entries
   where id = (select id from phase_5_ids where key = 'entry_a_1')),
  'copy confirmation leaves the source entry active'
);
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2026-07-03', '2026-07-03') $$,
  $$ values (1, 100::numeric) $$,
  'confirmed copy appears on its new Manila date'
);

insert into phase_5_ids (key, id)
select 'edit_preview', preview_id
from public.create_food_entry_edit_preview(
  (select id from phase_5_ids where key = 'entry_a_1'),
  'breakfast', '2026-07-03 16:00:00+00', 'Edited source entry',
  '[{"food_name":"Edited snapshot meal","quantity":1,"unit":"serving","calories":150,"protein_g":5,"carbohydrates_g":20,"fat_g":5}]'::jsonb
);
select results_eq(
  $$ select status, history_intent, total_calories, time_zone,
            jsonb_array_length(items)
     from public.create_food_entry_edit_preview(
       (select id from phase_5_ids where key = 'entry_a_1'),
       'breakfast', '2026-07-03 17:00:00+00', 'Second edit preview fixture',
       '[{"food_name":"Second edit fixture","quantity":1,"unit":"serving","calories":151,"protein_g":5,"carbohydrates_g":20,"fat_g":5}]'::jsonb
     ) $$,
  $$ values ('ready'::text, 'replace'::text, 151::numeric,
             'Asia/Manila'::text, 1) $$,
  'edit returns a complete replacement preview with server-calculated totals'
);
select ok(
  (select deleted_at is null from public.food_entries
   where id = (select id from phase_5_ids where key = 'entry_a_1')),
  'edit preview creation does not mutate confirmed history'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_5_ids where key = 'edit_preview'), 1, false,
    'phase5-edit-false-01'
  ) $$,
  '22023', 'explicit confirmation is required',
  'false edit confirmation leaves the source unchanged'
);
select ok(
  (select deleted_at is null from public.food_entries
   where id = (select id from phase_5_ids where key = 'entry_a_1')),
  'failed edit confirmation keeps the original active'
);
insert into phase_5_ids (key, id)
select 'edit_entry', entry_id
from public.confirm_food_log(
  (select id from phase_5_ids where key = 'edit_preview'), 1, true,
  'phase5-edit-confirm-01'
);
select ok(
  (select deleted_at is not null from public.food_entries
   where id = (select id from phase_5_ids where key = 'entry_a_1')),
  'exact edit confirmation atomically soft-deletes the replaced source'
);
select results_eq(
  $$ select total_calories, original_description
     from public.food_entries
     where id = (select id from phase_5_ids where key = 'edit_entry') $$,
  $$ values (150::numeric, 'Edited source entry'::text) $$,
  'replacement history snapshots the reviewed edited values'
);
select results_eq(
  $$ select calories, provider
     from public.food_entry_items
     where food_entry_id = (select id from phase_5_ids where key = 'edit_entry') $$,
  $$ values (150::numeric, 'manual_user_input_v1'::text) $$,
  'edited item provenance is identified as reviewed user input'
);
select results_eq(
  $$ select calories, provider
     from public.food_entry_items
     where food_entry_id = (select id from phase_5_ids where key = 'entry_a_1') $$,
  $$ values (100::numeric, 'manual_user_input_v1'::text) $$,
  'soft deletion never mutates the original immutable item snapshot'
);
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2026-07-01', '2026-07-01') $$,
  $$ values (0, 0::numeric) $$,
  'replaced source is excluded from its original Manila date'
);
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2026-07-04', '2026-07-04') $$,
  $$ values (1, 150::numeric) $$,
  'confirmed replacement appears on its reviewed Manila date'
);
select results_eq(
  $$ select logged_days, total_entries, average_daily_calories,
            complete_macro_days, average_daily_protein_g
     from public.get_progress_summary('2026-07-01', '2026-07-04') $$,
  $$ values (3, 3, 150::numeric, 2, 7.5::numeric) $$,
  'progress recalculates from active immutable snapshots after replacement'
);
select throws_ok(
  $$ select * from public.create_food_entry_edit_preview(
    (select id from phase_5_ids where key = 'entry_a_1'),
    'breakfast', now(), 'Deleted source retry',
    '[{"food_name":"Retry","quantity":1,"unit":"serving","calories":1}]'::jsonb
  ) $$,
  '42501', 'active entry not found',
  'a deleted source cannot begin another replacement'
);

select throws_ok(
  $$ select * from public.delete_food_entry(
    (select id from phase_5_ids where key = 'copy_entry'), false
  ) $$,
  '22023', 'explicit confirmation is required',
  'history deletion still requires explicit confirmation'
);
select ok(
  (select deleted_at is not null from public.delete_food_entry(
    (select id from phase_5_ids where key = 'copy_entry'), true
  )),
  'explicit deletion soft-deletes the copied entry'
);
select results_eq(
  $$ select entry_count, consumed_calories, has_entries
     from public.get_calendar_history('2026-07-03', '2026-07-03') $$,
  $$ values (0, 0::numeric, false) $$,
  'deleted copy is excluded from Calendar history'
);
select results_eq(
  $$ select logged_days, total_entries, average_daily_calories
     from public.get_progress_summary('2026-07-01', '2026-07-04') $$,
  $$ values (2, 2, 175::numeric) $$,
  'Progress excludes soft-deleted history after recalculation'
);

set local "request.jwt.claims" =
  '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select * from public.delete_food_entry(
    (select id from phase_5_ids where key = 'edit_entry'), true
  ) $$,
  '42501', 'entry not found',
  'another user cannot delete a replacement entry'
);

reset role;
select ok(
  not has_function_privilege(
    'anon', 'public.get_calendar_history(date,date)', 'EXECUTE'
  ),
  'anon cannot execute Calendar history reads'
);
select ok(
  not has_function_privilege(
    'anon', 'public.copy_food_entry_to_preview(uuid,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'anon cannot copy confirmed history to a preview'
);
select is(
  (select count(*)::integer
   from pg_catalog.pg_proc as procedure
   join pg_catalog.pg_namespace as namespace
     on namespace.oid = procedure.pronamespace
   where namespace.nspname = 'public'
     and procedure.proname in (
       'get_calendar_history', 'get_day_history', 'get_weight_trend',
       'get_progress_summary', 'copy_food_entry_to_preview',
       'create_food_entry_edit_preview'
     )
     and procedure.prosecdef),
  0,
  'Phase 5 public RPC wrappers remain security invoker'
);
select ok(
  not has_function_privilege(
    'authenticated', 'private.preview_items_snapshot_json(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated callers cannot execute private snapshot helpers'
);
select is(
  (select count(*)::integer
   from pg_catalog.pg_proc as procedure
   join pg_catalog.pg_namespace as namespace
     on namespace.oid = procedure.pronamespace
   where namespace.nspname = 'private'
     and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')),
  25,
  'authenticated can execute exactly twenty-five reviewed private bridge functions'
);
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  (select count(*) from public.get_day_history('2026-07-01')),
  0::bigint,
  'final owner history excludes the replaced source completely'
);
reset role;

select * from finish();
rollback;
