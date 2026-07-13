begin;

create extension if not exists pgtap with schema extensions;
select plan(47);
set constraints all deferred;

create temporary table phase_4_ids (
  key text primary key,
  id uuid not null
);
grant all on table phase_4_ids to authenticated;

insert into auth.users (id, email)
values
  ('41111111-1111-4111-8111-111111111111', 'phase4-a@example.test'),
  ('42222222-2222-4222-8222-222222222222', 'phase4-b@example.test');

insert into public.food_products (
  id, user_id, canonical_name, brand_name, barcode, market_country_code,
  serving_quantity, serving_unit, serving_weight_g, calories, protein_g,
  carbohydrates_g, fat_g, provider, provider_identifier, provider_version,
  provider_retrieved_at, attribution, is_estimated, confidence, uncertainty
) values
  (
    '4a111111-1111-4111-8111-111111111111', null,
    'PH Fixture Drink', 'Fixture Brand', '4801234567897', 'PH',
    1, 'bottle', 250, 120, 1, 28, 0,
    'server_catalog_fixture_v1', 'ph-fixture-drink', '2026.07', now(),
    'Development fixture only', false, 0.95, '[]'::jsonb
  ),
  (
    '4b111111-1111-4111-8111-111111111111', null,
    'Foreign Fixture Drink', 'Fixture Brand', '4801234567897', 'US',
    1, 'bottle', 355, 180, 1, 44, 0,
    'unconfigured_provider_fixture', 'foreign-fixture-drink', null, null,
    null, false, 0.7, '[]'::jsonb
  ),
  (
    '4c111111-1111-4111-8111-111111111111', null,
    'Different Barcode Product', 'Fixture Brand', '4800016007019', 'PH',
    1, 'pack', 50, 90, 2, 15, 2,
    'server_catalog_fixture_v1', 'other-fixture', '2026.07', now(),
    'Development fixture only', false, 0.9, '[]'::jsonb
  ),
  (
    '4d111111-1111-4111-8111-111111111111',
    '41111111-1111-4111-8111-111111111111',
    'Private Saved Barcode Food', 'My label', '123456789012', 'PH',
    1, 'pack', 40, 160, null, null, null,
    'user_manual_v1', null, null, null, null, false, null,
    '[{"category":"nutrition_source","message":"Macros unknown"}]'::jsonb
  );

insert into public.food_product_servings (
  id, food_product_id, serving_description, serving_quantity, serving_unit,
  serving_weight_g, calories, protein_g, carbohydrates_g, fat_g,
  market_country_code, provider, provider_identifier, provider_version,
  provider_retrieved_at, attribution, is_default, is_estimated, confidence,
  uncertainty
) values
  (
    '4e111111-1111-4111-8111-111111111111',
    '4a111111-1111-4111-8111-111111111111',
    '1 small bottle', 1, 'bottle', 250, 100, 1, 24, 0,
    'PH', 'server_catalog_fixture_v1', 'ph-fixture-small', '2026.07', now(),
    'Development fixture only', true, false, 0.95, '[]'::jsonb
  ),
  (
    '4f111111-1111-4111-8111-111111111111',
    '4a111111-1111-4111-8111-111111111111',
    '1 large bottle', 1, 'bottle', 500, 250, 2, 60, 0,
    'PH', 'server_catalog_fixture_v1', 'ph-fixture-large', '2026.07', now(),
    'Development fixture only', false, false, 0.95, '[]'::jsonb
  ),
  (
    '4f222222-2222-4222-8222-222222222222',
    '4d111111-1111-4111-8111-111111111111',
    '1 private pack', 1, 'pack', 40, 160, null, null, null,
    'PH', 'user_manual_v1', null, null, null, null, true, false, null,
    '[{"category":"nutrition_source","message":"Macros unknown"}]'::jsonb
  );

select has_table(
  'public', 'food_product_servings',
  'Phase 4 creates a server-owned serving option table'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class
   where oid = 'public.food_product_servings'::regclass),
  'food product servings have RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.food_product_servings', 'SELECT'),
  'authenticated users can read visible serving options'
);
select ok(
  not has_table_privilege('authenticated', 'public.food_product_servings', 'INSERT'),
  'authenticated users cannot insert provider serving observations'
);
select ok(
  not has_table_privilege('authenticated', 'private.nutrition_provider_registry', 'SELECT'),
  'provider integration status is server-only'
);
select is(
  private.normalize_gtin(' 480-1234567897 '),
  '04801234567897'::text,
  'server normalization produces the canonical GTIN-14 representation'
);
select is(
  private.normalize_gtin('036000291452'),
  private.normalize_gtin('0036000291452'),
  'equivalent UPC-A and EAN-13 values normalize to the same GTIN-14'
);
select ok(
  not private.is_valid_gtin('4801234567890'),
  'invalid GTIN check digits are rejected'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $$ select * from public.lookup_barcode_candidates('4801234567890', 'PH') $$,
  '22023',
  'barcode must be a valid GTIN-8, UPC-A, EAN-13, or GTIN-14',
  'lookup validates the canonical GTIN checksum before creating a session'
);

set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"phase4-oauth-client"}';
select throws_ok(
  $$ select * from public.lookup_barcode_candidates('4801234567897', 'PH') $$,
  '42501',
  'first-party authentication required',
  'OAuth callers cannot use the first-party barcode lookup path'
);

set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into phase_4_ids (key, id)
select 'unknown_scan', scan_session_id
from public.lookup_barcode_candidates('12345670', 'PH');

select results_eq(
  $$ select lookup_status, manual_entry_required, market_status, lookup_mode
     from public.lookup_barcode_candidates('12345670', 'PH') $$,
  $$ values ('unknown'::text, true, 'unknown'::text, 'server_catalog_snapshot'::text) $$,
  'unknown products return an explicit manual-entry fallback'
);
select is(
  (select count(*) from public.food_entries),
  0::bigint,
  'unknown lookup creates no diary entry'
);
select is(
  (select count(*) from public.scan_sessions
   where id = (select id from phase_4_ids where key = 'unknown_scan')),
  1::bigint,
  'unknown lookup creates only a bounded owner scan session'
);

set local "request.jwt.claims" =
  '{"sub":"42222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.scan_sessions
   where id = (select id from phase_4_ids where key = 'unknown_scan')),
  0::bigint,
  'another user cannot read an unknown lookup session'
);

set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into phase_4_ids (key, id)
select 'found_scan', scan_session_id
from public.lookup_barcode_candidates('4801234567897', 'PH')
limit 1;

select is(
  (select count(*) from public.lookup_barcode_candidates('4801234567897', 'PH')),
  3::bigint,
  'lookup returns two PH serving options and one foreign candidate'
);
select results_eq(
  $$ select market_status, candidate_rank
     from public.lookup_barcode_candidates('4801234567897', 'PH')
     order by candidate_rank limit 1 $$,
  $$ values ('PH'::text, 1) $$,
  'Philippine-market candidates rank before foreign observations'
);
select is(
  (select count(*) from public.lookup_barcode_candidates('4801234567897', 'PH')
   where food_product_id = '4a111111-1111-4111-8111-111111111111'),
  2::bigint,
  'a product exposes each server-owned serving option'
);
select is(
  (select market_warning from public.lookup_barcode_candidates('4801234567897', 'PH')
   where food_product_id = '4b111111-1111-4111-8111-111111111111'),
  'Philippine formulation or serving size may differ.'::text,
  'foreign candidates carry the required Philippine formulation warning'
);
select is(
  (select source_warning from public.lookup_barcode_candidates('4801234567897', 'PH')
   where serving_id = '4e111111-1111-4111-8111-111111111111'),
  'Development fixture data; not a live provider integration. Verify the package label.'::text,
  'fixture catalog data is never represented as a live integration'
);
select is(
  (select provider_terms_reviewed_at
   from public.lookup_barcode_candidates('4801234567897', 'PH')
   where serving_id = '4e111111-1111-4111-8111-111111111111'),
  null::timestamptz,
  'fixture candidates expose that provider terms have not been reviewed'
);
select results_eq(
  $$ select calories, protein_g, carbohydrates_g, fat_g
     from public.lookup_barcode_candidates('4801234567897', 'PH')
     where serving_id = '4e111111-1111-4111-8111-111111111111' $$,
  $$ values (100::numeric, 1::numeric, 24::numeric, 0::numeric) $$,
  'lookup returns review-only nutrition for the selected serving'
);

set local "request.jwt.claims" =
  '{"sub":"42222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.food_product_servings
   where food_product_id = '4d111111-1111-4111-8111-111111111111'),
  0::bigint,
  'another user cannot read private saved-food serving options'
);
select throws_ok(
  $$ select * from public.create_barcode_food_log_preview(
    (select id from phase_4_ids where key = 'found_scan'),
    '4a111111-1111-4111-8111-111111111111',
    '4e111111-1111-4111-8111-111111111111', 2,
    'snack', now(), 'Asia/Manila', 'Cross-user scan attempt'
  ) $$,
  '42501',
  'barcode scan session not found for current user',
  'another user cannot create a preview from the owner scan session'
);

set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select * from public.create_barcode_food_log_preview(
    (select id from phase_4_ids where key = 'found_scan'),
    '4a111111-1111-4111-8111-111111111111', null, 2,
    'snack', now(), 'Asia/Manila', 'Missing serving selection'
  ) $$,
  '22023',
  'selected product or serving does not match this scan',
  'a multi-serving product requires a server-owned serving selection'
);

insert into phase_4_ids (key, id)
select 'barcode_preview', preview_id
from public.create_barcode_food_log_preview(
  (select id from phase_4_ids where key = 'found_scan'),
  '4a111111-1111-4111-8111-111111111111',
  '4e111111-1111-4111-8111-111111111111', 2,
  'snack', '2026-07-14 01:00:00+08', 'Asia/Manila',
  'Two small bottles from barcode'
);

select results_eq(
  $$ select p.revision_number, p.status, r.total_calories, r.macro_data_complete
     from public.chatgpt_log_previews p
     join public.food_log_preview_revisions r
       on r.preview_id = p.id and r.revision_number = p.revision_number
     where p.id = (select id from phase_4_ids where key = 'barcode_preview') $$,
  $$ values (1, 'ready'::text, 200::numeric, true) $$,
  'barcode selection creates a complete presented revision 1'
);
select is(
  (select count(*) from public.food_entries),
  0::bigint,
  'barcode preview alone is not a permanent food log'
);
select is(
  (select source_scan_session_id from public.chatgpt_log_previews
   where id = (select id from phase_4_ids where key = 'barcode_preview')),
  (select id from phase_4_ids where key = 'found_scan'),
  'barcode preview retains its owner scan lineage'
);
select results_eq(
  $$ select quantity, unit, calories, serving_weight_g
     from public.food_log_preview_items
     where preview_id = (select id from phase_4_ids where key = 'barcode_preview')
       and revision_number = 1 $$,
  $$ values (2::numeric, 'bottle'::text, 200::numeric, 500::numeric) $$,
  'server multiplies the serving observation without accepting client totals'
);
select ok(
  (select uncertainty::text like '%not a live provider integration%'
   from public.food_log_preview_items
   where preview_id = (select id from phase_4_ids where key = 'barcode_preview')
     and revision_number = 1),
  'source warnings are copied into the presented preview uncertainty'
);
select ok(
  (select p.last_presented_at = r.presented_at
   from public.chatgpt_log_previews p
   join public.food_log_preview_revisions r
     on r.preview_id = p.id and r.revision_number = 1
   where p.id = (select id from phase_4_ids where key = 'barcode_preview')),
  'revision 1 is marked as the exact presented version'
);

select results_eq(
  $$ select revision_number, total_calories, serving_id
     from public.revise_barcode_food_log_preview(
       (select id from phase_4_ids where key = 'barcode_preview'), 1,
       '4f111111-1111-4111-8111-111111111111', 1
     ) $$,
  $$ values (2, 250::numeric, '4f111111-1111-4111-8111-111111111111'::uuid) $$,
  'serving correction creates and presents immutable revision 2'
);
select is(
  (select revision_number from public.chatgpt_log_previews
   where id = (select id from phase_4_ids where key = 'barcode_preview')),
  2,
  'preview current revision advances only after the new revision is complete'
);
select results_eq(
  $$ select revision_number, total_calories
     from public.food_log_preview_revisions
     where preview_id = (select id from phase_4_ids where key = 'barcode_preview')
     order by revision_number $$,
  $$ values (1, 200::numeric), (2, 250::numeric) $$,
  'serving revision preserves the earlier presented snapshot'
);
select throws_ok(
  $$ select * from public.revise_barcode_food_log_preview(
    (select id from phase_4_ids where key = 'barcode_preview'), 1,
    '4e111111-1111-4111-8111-111111111111', 1
  ) $$,
  '40001',
  'barcode preview revision is stale',
  'a stale serving edit cannot replace the current preview'
);

set local "request.jwt.claims" =
  '{"sub":"42222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select * from public.revise_barcode_food_log_preview(
    (select id from phase_4_ids where key = 'barcode_preview'), 2,
    '4e111111-1111-4111-8111-111111111111', 1
  ) $$,
  '42501',
  'barcode preview not found for current user',
  'another user cannot revise the barcode preview'
);

set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_4_ids where key = 'barcode_preview'), 1, true,
    'phase4-barcode-stale-01'
  ) $$,
  'P0001',
  'stale preview revision',
  'an earlier presented serving revision cannot be confirmed'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from phase_4_ids where key = 'barcode_preview'), 2, false,
    'phase4-barcode-false-01'
  ) $$,
  '22023',
  'explicit confirmation is required',
  'barcode confirmation requires explicit true for the exact revision'
);
select is(
  (select count(*) from public.food_entries),
  0::bigint,
  'stale and false confirmations leave the diary empty'
);

insert into phase_4_ids (key, id)
select 'barcode_entry', entry_id
from public.confirm_food_log(
  (select id from phase_4_ids where key = 'barcode_preview'), 2, true,
  'phase4-barcode-confirm-01'
);
select results_eq(
  $$ select confirmation.reused, confirmation.total_calories from public.food_entries e
     cross join lateral public.confirm_food_log(
       (select id from phase_4_ids where key = 'barcode_preview'), 2, true,
       'phase4-barcode-confirm-01'
     ) confirmation
     where e.id = confirmation.entry_id $$,
  $$ values (true, 250::numeric) $$,
  'identical barcode confirmation retry returns the original entry'
);
select is(
  (select count(*) from public.food_entries
   where source_preview_id = (select id from phase_4_ids where key = 'barcode_preview')),
  1::bigint,
  'barcode confirmation is exactly once for the owner and revision'
);
select results_eq(
  $$ select calories, provider, market_country_code
     from public.food_entry_items
     where food_entry_id = (select id from phase_4_ids where key = 'barcode_entry') $$,
  $$ values (250::numeric, 'server_catalog_fixture_v1'::text, 'PH'::text) $$,
  'confirmed history snapshots the reviewed serving and provider provenance'
);

set local "request.jwt.claims" =
  '{"sub":"42222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.food_entries
   where id = (select id from phase_4_ids where key = 'barcode_entry')),
  0::bigint,
  'another user cannot read the confirmed barcode entry'
);

reset role;
select ok(
  not has_function_privilege(
    'anon', 'public.lookup_barcode_candidates(text,text)', 'EXECUTE'
  ),
  'anon cannot execute barcode lookup'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_barcode_food_log_preview(uuid,uuid,uuid,numeric,text,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'anon cannot create a barcode preview'
);
select is(
  (select count(*)::integer
   from pg_catalog.pg_proc as procedure
   join pg_catalog.pg_namespace as namespace
     on namespace.oid = procedure.pronamespace
   where namespace.nspname = 'public'
     and procedure.proname in (
       'lookup_barcode_candidates',
       'create_barcode_food_log_preview',
       'revise_barcode_food_log_preview'
     )
     and procedure.prosecdef),
  0,
  'Phase 4 public RPC wrappers remain security invoker'
);
select ok(
  not has_function_privilege(
    'authenticated', 'private.is_valid_gtin(text)', 'EXECUTE'
  ),
  'authenticated callers cannot execute unreviewed private helpers'
);
select is(
  (select count(*) from public.food_entries),
  1::bigint,
  'the complete barcode workflow created one and only one permanent entry'
);

select * from finish();
rollback;
