begin;

create extension if not exists pgtap with schema extensions;
select plan(30);
set constraints all deferred;

create temporary table goal_planner_ids (
  key text primary key,
  id uuid not null
);

create temporary table goal_planner_snapshot (
  id uuid primary key,
  calorie_target numeric not null,
  protein_target_g numeric not null,
  carbohydrate_target_g numeric not null,
  fat_target_g numeric not null,
  weight_kg numeric not null,
  target_weight_kg numeric not null,
  current_bmi numeric not null,
  target_bmi numeric not null,
  goal text not null,
  goal_adjustment_kcal numeric not null,
  applied_weekly_weight_change_kg numeric not null,
  estimated_goal_date date not null
);

grant all on table goal_planner_ids to authenticated;
grant all on table goal_planner_snapshot to authenticated;

insert into auth.users (id, email)
values
  (
    '41111111-1111-4111-8111-111111111111',
    'goal-planner-a@example.test'
  ),
  (
    '42222222-2222-4222-8222-222222222222',
    'goal-planner-b@example.test'
  ),
  (
    '43333333-3333-4333-8333-333333333333',
    'goal-planner-c@example.test'
  );

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated"}';

select results_eq(
  $$
    select display_name, formula_sex, height_cm
    from public.upsert_profile(
      'Goal User A', '1990-01-01', 'female', 160, 'metric', 'Asia/Manila'
    )
  $$,
  $$ values ('Goal User A'::text, 'female'::text, 160::numeric) $$,
  'the planner uses an owner-bound adult profile'
);

select results_eq(
  $$
    select
      status,
      goal,
      weight_kg,
      target_weight_kg,
      current_bmi,
      target_bmi,
      requested_weekly_weight_change_kg
    from public.propose_nutrition_target(
      60, 55, 'moderately_active', 0.5, null
    )
  $$,
  $$
    values (
      'proposed'::text,
      'lose'::text,
      60::numeric,
      55::numeric,
      23.44::numeric,
      21.48::numeric,
      -0.5::numeric
    )
  $$,
  'a lower target weight server-derives loss and both BMI screening values'
);

select results_eq(
  $$
    select
      status,
      goal,
      target_weight_kg,
      target_bmi,
      requested_weekly_weight_change_kg
    from public.propose_nutrition_target(
      60, 65, 'moderately_active', 0.25, null
    )
  $$,
  $$
    values (
      'proposed'::text,
      'gain'::text,
      65::numeric,
      25.39::numeric,
      0.25::numeric
    )
  $$,
  'a higher target weight server-derives gain without a client goal flag'
);

select results_eq(
  $$
    select
      status,
      goal,
      target_weight_kg,
      target_bmi,
      requested_weekly_weight_change_kg,
      applied_weekly_weight_change_kg
    from public.propose_nutrition_target(
      60, 60.04, 'moderately_active', null, null
    )
  $$,
  $$
    values (
      'proposed'::text,
      'maintain'::text,
      60.04::numeric,
      23.45::numeric,
      0::numeric,
      0::numeric
    )
  $$,
  'a target within the rounding tolerance server-derives maintenance'
);

select is(
  (
    select count(*)
    from public.nutrition_targets
    where user_id = '41111111-1111-4111-8111-111111111111'
      and status = 'proposed'
  ),
  1::bigint,
  'recalculation replaces the prior draft instead of accumulating proposals'
);

select throws_ok(
  $$
    select *
    from public.propose_nutrition_target(
      50, 45, 'sedentary', 0.25, null
    )
  $$,
  '22023',
  'automatic weight-loss targets require a goal BMI of at least 18.5',
  'an automatic loss plan cannot target an underweight BMI'
);

select is(
  (
    select count(*)
    from public.nutrition_targets
    where user_id = '41111111-1111-4111-8111-111111111111'
      and status = 'proposed'
  ),
  1::bigint,
  'a rejected calculation leaves the previously reviewed proposal intact'
);

insert into goal_planner_snapshot (
  id,
  calorie_target,
  protein_target_g,
  carbohydrate_target_g,
  fat_target_g,
  weight_kg,
  target_weight_kg,
  current_bmi,
  target_bmi,
  goal,
  goal_adjustment_kcal,
  applied_weekly_weight_change_kg,
  estimated_goal_date
)
select
  target_id,
  calorie_target,
  protein_target_g,
  carbohydrate_target_g,
  fat_target_g,
  weight_kg,
  target_weight_kg,
  current_bmi,
  target_bmi,
  goal,
  goal_adjustment_kcal,
  applied_weekly_weight_change_kg,
  estimated_goal_date
from public.propose_nutrition_target(
  50, 48, 'sedentary', 1, null
);

insert into goal_planner_ids (key, id)
select 'floor_target_a', id
from goal_planner_snapshot;

select results_eq(
  $$
    select
      calorie_target,
      safe_calorie_floor,
      requested_weekly_weight_change_kg
    from public.nutrition_targets
    cross join lateral (
      select
        (macro_assumptions ->> 'safe_calorie_floor')::numeric
          as safe_calorie_floor
    ) as assumptions
    where id = (
      select id from goal_planner_ids where key = 'floor_target_a'
    )
  $$,
  $$ values (1200::numeric, 1200::numeric, -1::numeric) $$,
  'the female calorie floor is applied while the requested pace remains auditable'
);

select ok(
  (
    select goal_adjustment_kcal < 0
      and applied_weekly_weight_change_kg < 0
      and abs(applied_weekly_weight_change_kg) < 1
    from goal_planner_snapshot
  ),
  'a floor-clamped loss plan reports the smaller applied deficit and pace honestly'
);

select is(
  (
    select status
    from public.nutrition_targets
    where id = (
      select id from goal_planner_ids where key = 'floor_target_a'
    )
  ),
  'proposed',
  'calculation remains an inert proposal'
);

select is(
  (
    select onboarding_completed_at
    from public.profiles
    where user_id = '41111111-1111-4111-8111-111111111111'
  ),
  null::timestamptz,
  'calculation alone does not complete onboarding'
);

select throws_ok(
  $$
    select *
    from public.confirm_nutrition_target(
      (
        select id from goal_planner_ids where key = 'floor_target_a'
      ),
      false
    )
  $$,
  '22023',
  'explicit confirmation is required',
  'false confirmation cannot activate the proposal'
);

select is(
  (
    select status
    from public.nutrition_targets
    where id = (
      select id from goal_planner_ids where key = 'floor_target_a'
    )
  ),
  'proposed',
  'failed confirmation leaves the exact proposal unchanged'
);

select results_eq(
  $$
    select
      target_id,
      status,
      calorie_target,
      protein_target_g,
      carbohydrate_target_g,
      fat_target_g,
      weight_kg,
      target_weight_kg,
      current_bmi,
      target_bmi,
      goal,
      goal_adjustment_kcal,
      applied_weekly_weight_change_kg,
      estimated_goal_date
    from public.confirm_nutrition_target(
      (
        select id from goal_planner_ids where key = 'floor_target_a'
      ),
      true
    )
  $$,
  $$
    select
      id,
      'confirmed'::text,
      calorie_target,
      protein_target_g,
      carbohydrate_target_g,
      fat_target_g,
      weight_kg,
      target_weight_kg,
      current_bmi,
      target_bmi,
      goal,
      goal_adjustment_kcal,
      applied_weekly_weight_change_kg,
      estimated_goal_date
    from goal_planner_snapshot
  $$,
  'explicit confirmation activates the exact reviewed target snapshot'
);

select results_eq(
  $$
    select
      target_id,
      status,
      calorie_target,
      protein_target_g,
      target_weight_kg,
      current_bmi,
      target_bmi
    from public.confirm_nutrition_target(
      (
        select id from goal_planner_ids where key = 'floor_target_a'
      ),
      true
    )
  $$,
  $$
    select
      id,
      'confirmed'::text,
      calorie_target,
      protein_target_g,
      target_weight_kg,
      current_bmi,
      target_bmi
    from goal_planner_snapshot
  $$,
  'an identical confirmation retry returns the original confirmed snapshot'
);

select is(
  (
    select count(*)
    from public.nutrition_targets
    where user_id = '41111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'confirmation retry creates no duplicate target'
);

select ok(
  (
    select onboarding_completed_at is not null
    from public.profiles
    where user_id = '41111111-1111-4111-8111-111111111111'
  ),
  'confirmed goal target completes onboarding'
);

select results_eq(
  $$
    select reused, weight_kg
    from public.record_weight(
      now(), 'Asia/Manila', 61.5, 'goal-planner-weight-a-0001'
    )
  $$,
  $$ values (false, 61.5::numeric) $$,
  'an owner can record a newer measured weight'
);

select results_eq(
  $$
    select
      display_name,
      formula_sex,
      height_cm,
      current_weight_kg,
      target_weight_kg,
      activity_level,
      requested_weekly_weight_change_kg,
      has_confirmed_target
    from public.get_goal_setup()
  $$,
  $$
    values (
      'Goal User A'::text,
      'female'::text,
      160::numeric,
      61.5::numeric,
      48::numeric,
      'sedentary'::text,
      1::numeric,
      true
    )
  $$,
  'goal setup prefers the latest owned weight and remembers the confirmed plan'
);

set local "request.jwt.claims" =
  '{"sub":"42222222-2222-4222-8222-222222222222","role":"authenticated"}';

select results_eq(
  $$
    select display_name
    from public.upsert_profile(
      'Goal User B', '1988-01-01', 'male', 175, 'metric', 'Asia/Manila'
    )
  $$,
  $$ values ('Goal User B'::text) $$,
  'a second owner can create an independent planner profile'
);

insert into goal_planner_ids (key, id)
select 'target_b', target_id
from public.propose_nutrition_target(
  90, 80, 'lightly_active', 0.5, null
);

select results_eq(
  $$
    select
      display_name,
      current_weight_kg,
      target_weight_kg,
      has_confirmed_target
    from public.get_goal_setup()
  $$,
  $$
    values (
      'Goal User B'::text,
      90::numeric,
      80::numeric,
      false
    )
  $$,
  'goal setup returns only the second owner current proposal'
);

set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (
    select count(*)
    from public.nutrition_targets
    where user_id = '42222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'RLS hides another owner target'
);

select throws_ok(
  $$
    select *
    from public.confirm_nutrition_target(
      (select id from goal_planner_ids where key = 'target_b'),
      true
    )
  $$,
  '42501',
  'target not found',
  'an owner cannot confirm another owner target or learn its status'
);

set local "request.jwt.claims" =
  '{"sub":"43333333-3333-4333-8333-333333333333","role":"authenticated"}';

select results_eq(
  $$
    select display_name
    from public.upsert_profile(
      'Goal User C',
      ((now() at time zone 'Asia/Manila')::date - interval '100 years')::date,
      'female',
      140,
      'metric',
      'Asia/Manila'
    )
  $$,
  $$ values ('Goal User C'::text) $$,
  'the safety-floor fixture remains within the supported adult range'
);

select throws_ok(
  $$
    select *
    from public.propose_nutrition_target(
      37, 36.5, 'sedentary', 0.1, null
    )
  $$,
  '22023',
  'a safe automatic target cannot match this goal; consult a qualified professional',
  'the planner rejects loss when the safe floor would reverse the intended direction'
);

set local "request.jwt.claims" =
  '{"sub":"41111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"goal-planner-oauth-client"}';

select throws_ok(
  $$ select * from public.get_goal_setup() $$,
  '42501',
  'first-party authentication required',
  'OAuth-linked clients cannot read the first-party goal setup RPC'
);

select throws_ok(
  $$
    select *
    from public.propose_nutrition_target(
      60, 55, 'moderately_active', 0.5, null
    )
  $$,
  '42501',
  'first-party authentication required',
  'OAuth-linked clients cannot create first-party target proposals'
);

reset role;

select ok(
  not has_function_privilege(
    'anon',
    'public.get_goal_setup()',
    'EXECUTE'
  ),
  'anonymous callers cannot execute goal setup'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.propose_nutrition_target(numeric,numeric,text,numeric,date)',
    'EXECUTE'
  ),
  'anonymous callers cannot calculate a target proposal'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.confirm_nutrition_target(uuid,boolean)',
    'EXECUTE'
  ),
  'anonymous callers cannot confirm a target'
);

select * from finish();
rollback;
