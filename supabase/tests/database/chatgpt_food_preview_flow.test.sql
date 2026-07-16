begin;

create extension if not exists pgtap with schema extensions;
select no_plan();
set constraints all deferred;

create temporary table chatgpt_preview_ids (
  key text primary key,
  id uuid not null
);
grant all on table chatgpt_preview_ids to authenticated;

insert into auth.users (id, email) values
  ('81111111-1111-4111-8111-111111111111', 'chatgpt-preview-a@example.test'),
  ('82222222-2222-4222-8222-222222222222', 'chatgpt-preview-b@example.test');

insert into private.oauth_client_action_policies (
  client_id, action, enabled, approved_at, approved_by, notes
) values
  ('chatgpt-write-client', 'preview_food_log', true, now(), 'pgTAP', 'write flow fixture'),
  ('chatgpt-write-client', 'revise_food_log_preview', true, now(), 'pgTAP', 'write flow fixture'),
  ('chatgpt-write-client', 'confirm_food_log', true, now(), 'pgTAP', 'write flow fixture');

select has_function(
  'public', 'create_chatgpt_food_log_preview',
  array['text', 'timestamp with time zone', 'text', 'text', 'jsonb'],
  'ChatGPT preview creation has one bounded OAuth-compatible contract'
);
select has_function(
  'public', 'revise_chatgpt_food_log_preview',
  array['uuid', 'integer', 'text', 'timestamp with time zone', 'text', 'text', 'jsonb'],
  'ChatGPT revision requires one complete replacement snapshot'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"unapproved-client"}';

select throws_ok(
  $$ select * from public.create_chatgpt_food_log_preview(
    'lunch', '2026-07-16 12:00:00+08', 'Asia/Manila', 'Unapproved request',
    '[{"food_name":"Rice","quantity":1,"unit":"cup","calories":205}]'::jsonb
  ) $$,
  '42501', 'oauth client is not authorized for this action',
  'an unapproved OAuth client cannot create a preview'
);
select is(
  (select count(*) from public.chatgpt_log_previews where source_kind = 'chatgpt'),
  0::bigint,
  'a denied preview creates no temporary state'
);

set local "request.jwt.claims" =
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"chatgpt-write-client"}';

insert into chatgpt_preview_ids (key, id)
select 'meal', preview_id
from public.create_chatgpt_food_log_preview(
  'lunch', '2026-07-16 12:00:00+08', 'Asia/Manila',
  'McDonald''s 1-pc Chicken McDo meal with rice and gravy, no drink',
  '[
    {"food_name":"Steamed rice","quantity":1,"unit":"serving","calories":205,"protein_g":4.3,"carbohydrates_g":44.5,"fat_g":0.4,"is_estimated":false},
    {"food_name":"Chicken McDo with gravy","brand_name":"McDonald''s","quantity":1,"unit":"piece","calories":365,"protein_g":25.7,"carbohydrates_g":19.5,"fat_g":22.1,"confidence":0.65,"uncertainty":[{"code":"restaurant_estimate","message":"Recipe and oil absorption vary."}]}
  ]'::jsonb
);

select results_eq(
  $$ select p.source_kind, p.status, p.revision_number, r.total_calories,
            r.total_protein_g, r.total_carbohydrates_g, r.total_fat_g
     from public.chatgpt_log_previews p
     join public.food_log_preview_revisions r
       on r.preview_id = p.id and r.revision_number = p.revision_number
     where p.id = (select id from chatgpt_preview_ids where key = 'meal') $$,
  $$ values ('chatgpt'::text, 'ready'::text, 1, 570::numeric,
             30::numeric, 64::numeric, 22.5::numeric) $$,
  'the server creates a ready revision and sums item nutrition itself'
);
select is(
  (select jsonb_array_length(items)
   from public.create_chatgpt_food_log_preview(
     'snack', '2026-07-16 15:00:00+08', 'Asia/Manila', 'Disposable output-shape fixture',
     '[{"food_name":"Banana","quantity":1,"unit":"piece","calories":105}]'::jsonb
   ) limit 1),
  1,
  'the tool contract returns the complete item snapshot for presentation'
);
select is(
  (select count(*) from public.food_log_preview_items
   where preview_id = (select id from chatgpt_preview_ids where key = 'meal')
     and not is_estimated),
  0::bigint,
  'ChatGPT interpretation is always marked estimated even if input claims otherwise'
);
select ok(
  (select uncertainty @> '[{"code":"chatgpt_estimate"}]'::jsonb
   from public.food_log_preview_items
   where preview_id = (select id from chatgpt_preview_ids where key = 'meal')
     and food_name = 'Steamed rice'),
  'missing uncertainty is replaced with an explicit estimate warning'
);
select results_eq(
  $$ select distinct provider from public.food_log_preview_items
     where preview_id = (select id from chatgpt_preview_ids where key = 'meal') $$,
  array['chatgpt_interpretation_v1'::text],
  'the server owns interpretation provenance'
);
select is(
  (select count(*) from public.food_entries
   where source_preview_id = (select id from chatgpt_preview_ids where key = 'meal')),
  0::bigint,
  'creating a preview does not create a diary entry'
);

set local "request.jwt.claims" =
  '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated","client_id":"chatgpt-write-client"}';
select throws_ok(
  $$ select * from public.revise_chatgpt_food_log_preview(
    (select id from chatgpt_preview_ids where key = 'meal'), 1,
    'lunch', '2026-07-16 12:00:00+08', 'Asia/Manila', 'Cross-owner revision',
    '[{"food_name":"Rice","quantity":1,"unit":"serving","calories":180}]'::jsonb
  ) $$,
  '42501', 'preview not found',
  'an approved client still cannot revise another user''s preview'
);

set local "request.jwt.claims" =
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"chatgpt-write-client"}';
select results_eq(
  $$ select revision_number, total_calories
     from public.revise_chatgpt_food_log_preview(
       (select id from chatgpt_preview_ids where key = 'meal'), 1,
       'lunch', '2026-07-16 12:00:00+08', 'Asia/Manila',
       'Corrected McDonald''s meal with a smaller rice serving',
       '[
         {"food_name":"Steamed rice","quantity":0.75,"unit":"serving","calories":180,"protein_g":3.8,"carbohydrates_g":39.5,"fat_g":0.4,"uncertainty":{"portion":"corrected estimate"}},
         {"food_name":"Chicken McDo with gravy","brand_name":"McDonald''s","quantity":1,"unit":"piece","calories":365,"protein_g":25.7,"carbohydrates_g":19.5,"fat_g":22.1,"uncertainty":["restaurant estimate"]}
       ]'::jsonb
     ) $$,
  $$ values (2, 545::numeric) $$,
  'a correction creates and presents a complete next revision'
);
select is(
  (select count(*) from public.food_log_preview_revisions
   where preview_id = (select id from chatgpt_preview_ids where key = 'meal')),
  2::bigint,
  'the prior presented revision remains immutable for auditability'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from chatgpt_preview_ids where key = 'meal'), 1, true,
    'chatgpt-stale-confirmation'
  ) $$,
  'P0001', 'stale preview revision',
  'an earlier revision cannot be confirmed after correction'
);
select throws_ok(
  $$ select * from public.confirm_food_log(
    (select id from chatgpt_preview_ids where key = 'meal'), 2, false,
    'chatgpt-false-confirmation'
  ) $$,
  '22023', 'explicit confirmation is required',
  'the exact current revision still requires explicit confirmation'
);

select results_eq(
  $$ select reused, total_calories from public.confirm_food_log(
    (select id from chatgpt_preview_ids where key = 'meal'), 2, true,
    'chatgpt-exact-confirmation'
  ) $$,
  $$ values (false, 545::numeric) $$,
  'explicit exact confirmation creates one permanent entry'
);
select results_eq(
  $$ select reused, total_calories from public.confirm_food_log(
    (select id from chatgpt_preview_ids where key = 'meal'), 2, true,
    'chatgpt-exact-confirmation'
  ) $$,
  $$ values (true, 545::numeric) $$,
  'an identical retry reuses the completed result'
);
select is(
  (select count(*) from public.food_entries
   where source_preview_id = (select id from chatgpt_preview_ids where key = 'meal')),
  1::bigint,
  'idempotent reconnect cannot create a duplicate diary entry'
);

reset role;
select function_privs_are(
  'public', 'create_chatgpt_food_log_preview',
  array['text', 'timestamp with time zone', 'text', 'text', 'jsonb'],
  'authenticated', array['EXECUTE'],
  'only authenticated sessions can invoke ChatGPT preview creation'
);
select function_privs_are(
  'public', 'revise_chatgpt_food_log_preview',
  array['uuid', 'integer', 'text', 'timestamp with time zone', 'text', 'text', 'jsonb'],
  'authenticated', array['EXECUTE'],
  'only authenticated sessions can invoke ChatGPT preview revision'
);

select * from finish();
rollback;
