begin;

create extension if not exists pgtap with schema extensions;
select plan(32);
set constraints all deferred;

create temporary table phase_5_qa_ids (
  key text primary key,
  id uuid not null
);
grant all on table phase_5_qa_ids to authenticated;

insert into auth.users (id, email)
values
  ('53111111-1111-4111-8111-111111111111', 'phase5-qa-a@example.test'),
  ('53222222-2222-4222-8222-222222222222', 'phase5-qa-b@example.test');

insert into public.food_products (
  id, user_id, canonical_name, brand_name, market_country_code,
  serving_quantity, serving_unit, calories, protein_g, carbohydrates_g,
  fat_g, provider, provider_identifier, provider_version,
  provider_retrieved_at, attribution, is_estimated, confidence, uncertainty
) values (
  '53a11111-1111-4111-8111-111111111111', null,
  'Phase 5 QA catalog fixture v1', 'QA fixture', 'PH',
  1, 'serving', 321, 21, 31, 11,
  'phase5_qa_catalog_fixture', 'phase5-qa-product', 'v1',
  '2026-12-01 00:00:00+00', 'Synthetic QA fixture; not live data',
  false, 1, '[]'::jsonb
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"53111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into phase_5_qa_ids (key, id)
select 'preview_a_dec31', preview_id
from public.create_manual_food_log_preview(
  'dinner', '2026-12-31 15:59:59+00', 'Asia/Manila',
  'QA entry before Manila New Year',
  '[{"food_product_id":"53a11111-1111-4111-8111-111111111111","food_name":"Catalog-linked snapshot v1","quantity":1,"unit":"serving","calories":321,"protein_g":21,"carbohydrates_g":31,"fat_g":11}]'::jsonb
);
insert into phase_5_qa_ids (key, id)
select 'entry_a_dec31', entry_id
from public.confirm_food_log(
  (select id from phase_5_qa_ids where key = 'preview_a_dec31'), 1, true,
  'phase5-qa-entry-dec31'
);

insert into phase_5_qa_ids (key, id)
select 'preview_a_jan1', preview_id
from public.create_manual_food_log_preview(
  'breakfast', '2026-12-31 16:00:00+00', 'Asia/Manila',
  'QA entry at Manila New Year',
  '[{"food_name":"Incomplete New Year snapshot","quantity":1,"unit":"serving","calories":200,"uncertainty":["macros unavailable in QA fixture"]}]'::jsonb
);
insert into phase_5_qa_ids (key, id)
select 'entry_a_jan1', entry_id
from public.confirm_food_log(
  (select id from phase_5_qa_ids where key = 'preview_a_jan1'), 1, true,
  'phase5-qa-entry-jan1'
);

select * from public.record_weight(
  '2026-12-31 15:59:59+00', 'Asia/Manila', 72, 'phase5-qa-weight-dec31'
);
select * from public.record_weight(
  '2026-12-31 16:00:00+00', 'Asia/Manila', 71.5, 'phase5-qa-weight-jan1'
);
select * from public.record_weight(
  '2027-01-02 16:00:00+00', 'Asia/Manila', 71, 'phase5-qa-weight-jan3'
);

select throws_ok(
  $$ select * from public.record_weight(
    now(), 'UTC', 70, 'phase5-qa-invalid-zone'
  ) $$,
  '22023',
  'timezone must be Asia/Manila for Philippine diary dates',
  'weight writes reject a client-selected non-Manila diary timezone'
);

set local "request.jwt.claims" =
  '{"sub":"53222222-2222-4222-8222-222222222222","role":"authenticated"}';
insert into phase_5_qa_ids (key, id)
select 'preview_b_jan1', preview_id
from public.create_manual_food_log_preview(
  'lunch', '2026-12-31 17:00:00+00', 'Asia/Manila',
  'Other-user New Year fixture',
  '[{"food_name":"Other-user meal","quantity":1,"unit":"serving","calories":999,"protein_g":99,"carbohydrates_g":99,"fat_g":99}]'::jsonb
);
insert into phase_5_qa_ids (key, id)
select 'entry_b_jan1', entry_id
from public.confirm_food_log(
  (select id from phase_5_qa_ids where key = 'preview_b_jan1'), 1, true,
  'phase5-qa-entry-b-jan1'
);

reset role;
update public.food_products
set canonical_name = 'Phase 5 QA catalog fixture v2',
    calories = 999,
    protein_g = 99,
    provider_version = 'v2',
    updated_at = now()
where id = '53a11111-1111-4111-8111-111111111111';

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"53111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.get_calendar_history('2026-12-31', '2027-01-02')),
  3::bigint,
  'calendar spans a Manila month and year boundary without dropping dates'
);
select results_eq(
  $$ select local_date, entry_count, consumed_calories, macro_data_complete
     from public.get_calendar_history('2026-12-31', '2026-12-31') $$,
  $$ values ('2026-12-31'::date, 1, 321::numeric, true) $$,
  'the instant before UTC 16:00 remains on Manila December 31'
);
select results_eq(
  $$ select local_date, entry_count, consumed_calories,
            consumed_protein_g, macro_data_complete
     from public.get_calendar_history('2027-01-01', '2027-01-01') $$,
  $$ values ('2027-01-01'::date, 1, 200::numeric, null::numeric, false) $$,
  'UTC 16:00 crosses into Manila January 1 and missing macros remain null'
);
select results_eq(
  $$ select entry_count, consumed_calories, has_entries
     from public.get_calendar_history('2027-01-02', '2027-01-02') $$,
  $$ values (0, 0::numeric, false) $$,
  'an empty New Year date remains an explicit no-record day'
);
select is(
  (select local_date from public.get_day_history('2027-01-01')),
  '2027-01-01'::date,
  'day history derives its New Year date from the stored instant in Manila'
);
select is(
  (select (items -> 0 ->> 'macro_data_complete')::boolean
   from public.get_day_history('2027-01-01')),
  false,
  'day history exposes an incomplete item snapshot without zero-filling macros'
);
select results_eq(
  $$ select items -> 0 ->> 'food_name',
            (items -> 0 ->> 'calories')::numeric,
            items -> 0 ->> 'provider'
     from public.get_day_history('2026-12-31') $$,
  $$ values (
    'Catalog-linked snapshot v1'::text, 321::numeric,
    'manual_user_input_v1'::text
  ) $$,
  'later catalog changes do not rewrite a confirmed historical snapshot'
);

set local "request.jwt.claims" =
  '{"sub":"53222222-2222-4222-8222-222222222222","role":"authenticated"}';
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2027-01-01', '2027-01-01') $$,
  $$ values (1, 999::numeric) $$,
  'another user sees only their own New Year summary'
);
select is(
  (select count(*) from public.get_day_history('2027-01-01')
   where entry_id = (select id from phase_5_qa_ids where key = 'entry_a_jan1')),
  0::bigint,
  'another user cannot read owner A day-history snapshots'
);
select throws_ok(
  $$ select * from public.copy_food_entry_to_preview(
    (select id from phase_5_qa_ids where key = 'entry_a_dec31'),
    'dinner', '2027-01-01 16:00:00+00'
  ) $$,
  '42501', 'active entry not found',
  'another user cannot copy an owner entry'
);

set local "request.jwt.claims" =
  '{"sub":"53111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into phase_5_qa_ids (key, id)
select 'copy_preview', preview_id
from public.copy_food_entry_to_preview(
  (select id from phase_5_qa_ids where key = 'entry_a_dec31'),
  'dinner', '2027-01-01 16:00:00+00'
);
select results_eq(
  $$ select status, history_intent, total_calories,
            jsonb_array_length(items), time_zone
     from public.copy_food_entry_to_preview(
       (select id from phase_5_qa_ids where key = 'entry_a_dec31'),
       'dinner', '2027-01-01 17:00:00+00'
     ) $$,
  $$ values ('ready'::text, 'copy'::text, 321::numeric, 1,
             'Asia/Manila'::text) $$,
  'copy returns a self-contained presented preview using immutable values'
);
select is(
  (select count(*) from public.food_entries
   where user_id = '53111111-1111-4111-8111-111111111111'),
  2::bigint,
  'copy preview creation makes no permanent history write'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_5_qa_ids where key = 'copy_preview'), 1, false,
    'phase5-qa-copy-false'
  ) $$,
  '22023', 'explicit confirmation is required',
  'copy cannot become permanent without explicit exact confirmation'
);
insert into phase_5_qa_ids (key, id)
select 'copy_entry', entry_id
from public.confirm_food_log(
  (select id from phase_5_qa_ids where key = 'copy_preview'), 1, true,
  'phase5-qa-copy-confirm'
);
select results_eq(
  $$ select reused, total_calories from public.confirm_food_log(
    (select id from phase_5_qa_ids where key = 'copy_preview'), 1, true,
    'phase5-qa-copy-confirm'
  ) $$,
  $$ values (true, 321::numeric) $$,
  'copy confirmation retry reuses the exact permanent entry'
);
select ok(
  (select deleted_at is null from public.food_entries
   where id = (select id from phase_5_qa_ids where key = 'entry_a_dec31')),
  'copy confirmation leaves the source snapshot active'
);
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2027-01-02', '2027-01-02') $$,
  $$ values (1, 321::numeric) $$,
  'confirmed copy appears only on its new Manila date'
);

insert into phase_5_qa_ids (key, id)
select 'edit_preview', preview_id
from public.create_food_entry_edit_preview(
  (select id from phase_5_qa_ids where key = 'entry_a_dec31'),
  'dinner', '2027-01-02 16:00:00+00', 'Reviewed New Year replacement',
  '[{"food_name":"Reviewed replacement","quantity":1,"unit":"serving","calories":150,"protein_g":5,"carbohydrates_g":20,"fat_g":5}]'::jsonb
);
select results_eq(
  $$ select status, history_intent, total_calories,
            jsonb_array_length(items), source_food_entry_id
     from public.create_food_entry_edit_preview(
       (select id from phase_5_qa_ids where key = 'entry_a_dec31'),
       'dinner', '2027-01-02 17:00:00+00', 'Second QA edit preview',
       '[{"food_name":"Second QA replacement","quantity":1,"unit":"serving","calories":151,"protein_g":5,"carbohydrates_g":20,"fat_g":5}]'::jsonb
     ) $$,
  $$ values (
    'ready'::text, 'replace'::text, 151::numeric, 1,
    (select id from phase_5_qa_ids where key = 'entry_a_dec31')
  ) $$,
  'edit returns a complete replacement preview with source lineage'
);
select ok(
  (select deleted_at is null from public.food_entries
   where id = (select id from phase_5_qa_ids where key = 'entry_a_dec31')),
  'creating an edit preview leaves confirmed history unchanged'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_5_qa_ids where key = 'edit_preview'), 1, false,
    'phase5-qa-edit-false'
  ) $$,
  '22023', 'explicit confirmation is required',
  'a false edit confirmation cannot replace history'
);
insert into phase_5_qa_ids (key, id)
select 'edit_entry', entry_id
from public.confirm_food_log(
  (select id from phase_5_qa_ids where key = 'edit_preview'), 1, true,
  'phase5-qa-edit-confirm'
);
select ok(
  (select deleted_at is not null from public.food_entries
   where id = (select id from phase_5_qa_ids where key = 'entry_a_dec31')),
  'exact edit confirmation atomically soft-deletes the source'
);
select results_eq(
  $$ select reused, total_calories from public.confirm_food_log(
    (select id from phase_5_qa_ids where key = 'edit_preview'), 1, true,
    'phase5-qa-edit-confirm'
  ) $$,
  $$ values (true, 150::numeric) $$,
  'replacement confirmation retry remains idempotent'
);
select results_eq(
  $$ select calories, food_name, provider
     from public.food_entry_items
     where food_entry_id = (select id from phase_5_qa_ids where key = 'entry_a_dec31') $$,
  $$ values (321::numeric, 'Catalog-linked snapshot v1'::text,
             'manual_user_input_v1'::text) $$,
  'replacement soft deletion does not mutate the original item snapshot'
);
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2026-12-31', '2026-12-31') $$,
  $$ values (0, 0::numeric) $$,
  'replaced history disappears from its former Manila date'
);
select results_eq(
  $$ select entry_count, consumed_calories
     from public.get_calendar_history('2027-01-03', '2027-01-03') $$,
  $$ values (1, 150::numeric) $$,
  'confirmed replacement appears on its reviewed Manila date'
);

select throws_ok(
  $$ select * from public.delete_food_entry(
    (select id from phase_5_qa_ids where key = 'copy_entry'), false
  ) $$,
  '22023', 'explicit confirmation is required',
  'deleting copied history also requires explicit confirmation'
);
select ok(
  (select deleted_at is not null from public.delete_food_entry(
    (select id from phase_5_qa_ids where key = 'copy_entry'), true
  )),
  'explicit deletion soft-deletes the copied entry'
);
select results_eq(
  $$ select entry_count, consumed_calories, has_entries
     from public.get_calendar_history('2027-01-02', '2027-01-02') $$,
  $$ values (0, 0::numeric, false) $$,
  'calendar recalculates the copied date after deletion'
);
select results_eq(
  $$ select logged_days, total_entries, average_daily_calories,
            complete_macro_days, average_daily_protein_g
     from public.get_progress_summary('2026-12-31', '2027-01-03') $$,
  $$ values (2, 2, 175::numeric, 1, 5::numeric) $$,
  'progress recalculates active entries and excludes incomplete macros from macro averages'
);
select results_eq(
  $$ select local_date, weight_kg, days_since_previous
     from public.get_weight_trend('2026-12-31', '2027-01-03')
     order by measured_at $$,
  $$ values
    ('2026-12-31'::date, 72::numeric, null::integer),
    ('2027-01-01'::date, 71.5::numeric, 1),
    ('2027-01-03'::date, 71::numeric, 2)
  $$,
  'weight history preserves sparse New Year points and explicit day gaps'
);

reset role;
select ok(
  not has_function_privilege(
    'anon',
    'public.create_food_entry_edit_preview(uuid,text,timestamp with time zone,text,jsonb)',
    'EXECUTE'
  ),
  'anonymous callers cannot create replacement previews'
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
  'all Phase 5 public RPC wrappers remain security invoker'
);

select * from finish();
rollback;
