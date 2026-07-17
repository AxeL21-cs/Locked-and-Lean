-- Goal-weight target planner.
--
-- BMI is a screening value shown for context. It is not used as the calorie
-- formula. Calories remain a versioned Mifflin-St Jeor estimate adjusted by
-- activity and a user-reviewed pace. Protein remains the versioned balanced
-- macro assumption until a separately reviewed protein model is introduced.

alter table public.nutrition_targets
  add column target_weight_kg numeric(6,2),
  add column current_bmi numeric(6,2),
  add column target_bmi numeric(6,2),
  add column estimated_goal_date date;

alter table public.nutrition_targets
  add constraint nutrition_targets_target_weight_check check (
    target_weight_kg is null or target_weight_kg between 20 and 500
  ),
  add constraint nutrition_targets_current_bmi_check check (
    current_bmi is null or current_bmi between 5 and 300
  ),
  add constraint nutrition_targets_target_bmi_check check (
    target_bmi is null or target_bmi between 5 and 300
  );

-- Formula inputs changed after a proposal was created must invalidate that
-- proposal. This prevents an old snapshot from being confirmed against a newly
-- edited profile.
create or replace function private.upsert_profile(
  p_display_name text,
  p_birth_date date,
  p_formula_sex text,
  p_height_cm numeric,
  p_preferred_units text,
  p_time_zone text
)
returns table (
  user_id uuid, display_name text, birth_date date, formula_sex text,
  height_cm numeric, preferred_units text, time_zone text,
  onboarding_completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_local_today date;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'display name is invalid';
  end if;
  if p_formula_sex not in ('female', 'male') then
    raise exception using errcode = '22023', message = 'formula sex is invalid';
  end if;
  if p_height_cm is null or p_height_cm not between 50 and 300 then
    raise exception using errcode = '22023', message = 'height is invalid';
  end if;
  if p_preferred_units <> 'metric' then
    raise exception using errcode = '22023', message = 'preferred units are invalid';
  end if;

  v_local_today := private.local_date_for_zone(now(), p_time_zone);
  if p_birth_date is null
    or p_birth_date > v_local_today - interval '18 years'
    or p_birth_date < v_local_today - interval '120 years' then
    raise exception using errcode = '22023', message = 'personalized targets require an adult aged 18 to 120';
  end if;

  insert into public.profiles as profile (
    user_id, display_name, country_code, time_zone, preferred_units,
    birth_date, formula_sex, height_cm, updated_at
  ) values (
    v_user_id, btrim(p_display_name), 'PH', p_time_zone, p_preferred_units,
    p_birth_date, p_formula_sex, p_height_cm, now()
  )
  on conflict on constraint profiles_pkey do update
  set display_name = excluded.display_name,
      country_code = 'PH',
      time_zone = excluded.time_zone,
      preferred_units = excluded.preferred_units,
      birth_date = excluded.birth_date,
      formula_sex = excluded.formula_sex,
      height_cm = excluded.height_cm,
      updated_at = now();

  delete from public.nutrition_targets as target
  where target.user_id = v_user_id and target.status = 'proposed';

  return query
  select profile.user_id, profile.display_name, profile.birth_date,
         profile.formula_sex, profile.height_cm, profile.preferred_units,
         profile.time_zone, profile.onboarding_completed_at
  from public.profiles as profile
  where profile.user_id = v_user_id;
end;
$$;

-- The previous RPC accepted a client-selected goal without a target weight.
-- Remove it so there is no target-weight-free overload left callable.
drop function if exists public.propose_nutrition_target(
  numeric, text, text, numeric, date
);
drop function if exists private.propose_nutrition_target(
  numeric, text, text, numeric, date
);
drop function if exists public.confirm_nutrition_target(uuid, boolean);
drop function if exists private.confirm_nutrition_target(uuid, boolean);

create or replace function private.get_goal_setup()
returns table (
  display_name text,
  age_years smallint,
  formula_sex text,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  activity_level text,
  requested_weekly_weight_change_kg numeric,
  has_confirmed_target boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_target public.nutrition_targets%rowtype;
  v_latest_weight numeric;
  v_local_today date;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;

  select profile.* into v_profile
  from public.profiles as profile
  where profile.user_id = v_user_id;

  if not found then
    return query
    select null::text, null::smallint, null::text, null::numeric,
           null::numeric, null::numeric, null::text, null::numeric, false;
    return;
  end if;

  select target.* into v_target
  from public.nutrition_targets as target
  where target.user_id = v_user_id
    and target.status in ('confirmed', 'proposed')
  order by
    case target.status when 'proposed' then 0 else 1 end,
    target.created_at desc
  limit 1;

  select weight.weight_kg into v_latest_weight
  from public.weight_logs as weight
  where weight.user_id = v_user_id
  order by weight.measured_at desc, weight.created_at desc
  limit 1;

  v_local_today := private.local_date_for_zone(now(), v_profile.time_zone);

  return query
  select
    v_profile.display_name,
    extract(year from age(v_local_today, v_profile.birth_date))::smallint,
    v_profile.formula_sex,
    v_profile.height_cm,
    coalesce(v_latest_weight, v_target.weight_kg),
    v_target.target_weight_kg,
    v_target.activity_level,
    abs(v_target.requested_weekly_weight_change_kg),
    exists (
      select 1
      from public.nutrition_targets as confirmed
      where confirmed.user_id = v_user_id
        and confirmed.status = 'confirmed'
        and confirmed.effective_to is null
    );
end;
$$;

create or replace function public.get_goal_setup()
returns table (
  display_name text,
  age_years smallint,
  formula_sex text,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  activity_level text,
  requested_weekly_weight_change_kg numeric,
  has_confirmed_target boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_goal_setup()
$$;

create or replace function private.propose_nutrition_target(
  p_weight_kg numeric,
  p_target_weight_kg numeric,
  p_activity_level text,
  p_requested_weekly_weight_change_kg numeric default null,
  p_effective_from date default null
)
returns table (
  target_id uuid,
  status text,
  effective_from date,
  calorie_target numeric,
  protein_target_g numeric,
  carbohydrate_target_g numeric,
  fat_target_g numeric,
  formula_name text,
  formula_version text,
  age_years smallint,
  formula_sex text,
  height_cm numeric,
  weight_kg numeric,
  target_weight_kg numeric,
  current_bmi numeric,
  target_bmi numeric,
  activity_level text,
  activity_multiplier numeric,
  goal text,
  maintenance_calorie_estimate numeric,
  goal_adjustment_kcal numeric,
  requested_weekly_weight_change_kg numeric,
  applied_weekly_weight_change_kg numeric,
  estimated_goal_date date,
  safe_calorie_floor numeric,
  macro_assumptions jsonb,
  informational_disclaimer_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_local_today date;
  v_effective_from date;
  v_age smallint;
  v_multiplier numeric(5,3);
  v_goal text;
  v_weight numeric(6,2);
  v_target_weight numeric(6,2);
  v_rate numeric(5,3);
  v_signed_rate numeric(5,3);
  v_current_bmi numeric(6,2);
  v_target_bmi numeric(6,2);
  v_bmr numeric;
  v_tdee numeric;
  v_requested_adjustment numeric;
  v_applied_adjustment numeric(7,2);
  v_applied_rate numeric(6,3);
  v_floor numeric(8,2);
  v_calories numeric(8,2);
  v_goal_weeks integer;
  v_goal_date date;
  v_target_id uuid;
  v_open_effective_from date;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;

  select profile.* into v_profile
  from public.profiles as profile
  where profile.user_id = v_user_id
  for update;

  if not found or v_profile.birth_date is null or v_profile.formula_sex is null
    or v_profile.height_cm is null then
    raise exception using errcode = 'P0001', message = 'complete profile required';
  end if;

  v_local_today := private.local_date_for_zone(now(), v_profile.time_zone);
  v_age := extract(year from age(v_local_today, v_profile.birth_date))::smallint;
  if v_age not between 18 and 120 then
    raise exception using errcode = '22023', message = 'personalized targets require an adult aged 18 to 120';
  end if;
  if p_weight_kg is null or p_weight_kg not between 20 and 500 then
    raise exception using errcode = '22023', message = 'current weight is invalid';
  end if;
  if p_target_weight_kg is null or p_target_weight_kg not between 20 and 500 then
    raise exception using errcode = '22023', message = 'target weight is invalid';
  end if;

  v_weight := round(p_weight_kg, 2);
  v_target_weight := round(p_target_weight_kg, 2);

  v_multiplier := case p_activity_level
    when 'sedentary' then 1.200
    when 'lightly_active' then 1.375
    when 'moderately_active' then 1.550
    when 'very_active' then 1.725
    when 'extra_active' then 1.900
    else null
  end;
  if v_multiplier is null then
    raise exception using errcode = '22023', message = 'activity level is invalid';
  end if;

  v_goal := case
    when v_target_weight < v_weight - 0.05 then 'lose'
    when v_target_weight > v_weight + 0.05 then 'gain'
    else 'maintain'
  end;

  if p_requested_weekly_weight_change_kg is not null
    and p_requested_weekly_weight_change_kg not between 0.1 and 1 then
    raise exception using errcode = '22023', message = 'requested weekly weight change is invalid';
  end if;

  if v_goal = 'maintain' and p_requested_weekly_weight_change_kg is not null then
    raise exception using errcode = '22023', message = 'maintenance does not use a weekly weight-change pace';
  end if;

  v_rate := coalesce(
    p_requested_weekly_weight_change_kg,
    case v_goal when 'lose' then 0.500 when 'gain' then 0.250 else 0 end
  );
  v_signed_rate := case
    when v_goal = 'lose' then -v_rate
    when v_goal = 'gain' then v_rate
    else 0
  end;

  v_current_bmi := round(
    v_weight / power(v_profile.height_cm / 100, 2),
    2
  );
  v_target_bmi := round(
    v_target_weight / power(v_profile.height_cm / 100, 2),
    2
  );

  if v_current_bmi not between 5 and 300
    or v_target_bmi not between 5 and 300 then
    raise exception using
      errcode = '22023',
      message = 'the supplied measurements are outside the supported BMI range';
  end if;

  if v_goal = 'lose' and v_target_bmi < 18.5 then
    raise exception using
      errcode = '22023',
      message = 'automatic weight-loss targets require a goal BMI of at least 18.5';
  end if;

  select target.effective_from into v_open_effective_from
  from public.nutrition_targets as target
  where target.user_id = v_user_id
    and target.status = 'confirmed'
    and target.effective_to is null
  order by target.effective_from desc
  limit 1;

  v_effective_from := coalesce(
    p_effective_from,
    greatest(v_local_today, coalesce(v_open_effective_from + 1, v_local_today))
  );
  if v_effective_from < v_local_today
    or (v_open_effective_from is not null and v_effective_from <= v_open_effective_from) then
    raise exception using errcode = '22023', message = 'effective date must follow the current target';
  end if;

  v_bmr := 10 * v_weight + 6.25 * v_profile.height_cm - 5 * v_age
    + case v_profile.formula_sex when 'male' then 5 else -161 end;
  if v_bmr <= 0 then
    raise exception using errcode = '22023', message = 'the supplied measurements are outside the supported formula range';
  end if;

  v_tdee := v_bmr * v_multiplier;
  v_requested_adjustment := v_signed_rate * 7700 / 7;
  v_floor := case v_profile.formula_sex when 'male' then 1500 else 1200 end;

  if v_goal in ('lose', 'maintain') and v_tdee < v_floor then
    raise exception using
      errcode = '22023',
      message = 'a safe automatic target cannot match this goal; consult a qualified professional';
  end if;

  v_calories := round(greatest(v_floor, v_tdee + v_requested_adjustment), 0);
  if v_calories > 10000 then
    raise exception using
      errcode = '22023',
      message = 'the calculated calorie target is outside the supported range';
  end if;
  v_applied_adjustment := round(v_calories - v_tdee, 2);

  if v_goal = 'lose' and v_applied_adjustment >= 0 then
    raise exception using
      errcode = '22023',
      message = 'a safe automatic calorie deficit cannot be calculated for these inputs';
  end if;
  if v_goal = 'maintain' and abs(v_applied_adjustment) > 1 then
    raise exception using
      errcode = '22023',
      message = 'a safe automatic maintenance target cannot be calculated for these inputs';
  end if;

  v_applied_rate := case
    when v_goal = 'maintain' then 0
    else round(abs(v_applied_adjustment) * 7 / 7700, 3)
  end;

  if v_goal = 'maintain' then
    v_goal_weeks := 0;
    v_goal_date := v_local_today;
  elsif v_applied_rate > 0 then
    v_goal_weeks := ceil(
      abs(v_target_weight - v_weight) / v_applied_rate
    )::integer;
    v_goal_date := v_effective_from + (v_goal_weeks * 7);
  else
    raise exception using
      errcode = '22023',
      message = 'a goal timeline cannot be calculated for these inputs';
  end if;

  delete from public.nutrition_targets as target
  where target.user_id = v_user_id and target.status = 'proposed';

  insert into public.nutrition_targets (
    user_id, status, effective_from, calorie_target, protein_target_g,
    carbohydrate_target_g, fat_target_g, formula_name, formula_version,
    age_years, formula_sex, height_cm, weight_kg, target_weight_kg,
    current_bmi, target_bmi, activity_level, activity_multiplier, goal,
    goal_adjustment_kcal, requested_weekly_weight_change_kg,
    estimated_goal_date, macro_assumptions,
    informational_disclaimer_version
  ) values (
    v_user_id, 'proposed', v_effective_from, v_calories,
    round(v_calories * 0.25 / 4, 2),
    round(v_calories * 0.45 / 4, 2),
    round(v_calories * 0.30 / 9, 2),
    'Mifflin-St Jeor', 'locked-and-lean-msj-goal-v2',
    v_age, v_profile.formula_sex, v_profile.height_cm, v_weight,
    v_target_weight, v_current_bmi, v_target_bmi, p_activity_level,
    v_multiplier, v_goal, v_applied_adjustment, v_signed_rate,
    v_goal_date,
    jsonb_build_object(
      'version', 'balanced-macros-v1',
      'protein_calorie_fraction', 0.25,
      'carbohydrate_calorie_fraction', 0.45,
      'fat_calorie_fraction', 0.30,
      'kilocalories_per_kg', 7700,
      'safe_calorie_floor', v_floor,
      'requested_weekly_weight_change_kg', v_signed_rate,
      'applied_weekly_weight_change_kg',
        case when v_goal = 'lose' then -v_applied_rate else v_applied_rate end,
      'goal_weeks', v_goal_weeks,
      'bmi_is_screening_only', true,
      'protein_method', '25 percent of target calories',
      'default_rate_applied', p_requested_weekly_weight_change_kg is null
    ),
    'adult-estimate-not-medical-advice-v2'
  )
  returning id into v_target_id;

  return query
  select
    target.id,
    target.status,
    target.effective_from,
    target.calorie_target,
    target.protein_target_g,
    target.carbohydrate_target_g,
    target.fat_target_g,
    target.formula_name,
    target.formula_version,
    target.age_years,
    target.formula_sex,
    target.height_cm,
    target.weight_kg,
    target.target_weight_kg,
    target.current_bmi,
    target.target_bmi,
    target.activity_level,
    target.activity_multiplier,
    target.goal,
    round(target.calorie_target - target.goal_adjustment_kcal, 2),
    target.goal_adjustment_kcal,
    target.requested_weekly_weight_change_kg,
    (target.macro_assumptions ->> 'applied_weekly_weight_change_kg')::numeric,
    target.estimated_goal_date,
    (target.macro_assumptions ->> 'safe_calorie_floor')::numeric,
    target.macro_assumptions,
    target.informational_disclaimer_version
  from public.nutrition_targets as target
  where target.id = v_target_id and target.user_id = v_user_id;
end;
$$;

create or replace function public.propose_nutrition_target(
  p_weight_kg numeric,
  p_target_weight_kg numeric,
  p_activity_level text,
  p_requested_weekly_weight_change_kg numeric default null,
  p_effective_from date default null
)
returns table (
  target_id uuid,
  status text,
  effective_from date,
  calorie_target numeric,
  protein_target_g numeric,
  carbohydrate_target_g numeric,
  fat_target_g numeric,
  formula_name text,
  formula_version text,
  age_years smallint,
  formula_sex text,
  height_cm numeric,
  weight_kg numeric,
  target_weight_kg numeric,
  current_bmi numeric,
  target_bmi numeric,
  activity_level text,
  activity_multiplier numeric,
  goal text,
  maintenance_calorie_estimate numeric,
  goal_adjustment_kcal numeric,
  requested_weekly_weight_change_kg numeric,
  applied_weekly_weight_change_kg numeric,
  estimated_goal_date date,
  safe_calorie_floor numeric,
  macro_assumptions jsonb,
  informational_disclaimer_version text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.propose_nutrition_target(
    p_weight_kg, p_target_weight_kg, p_activity_level,
    p_requested_weekly_weight_change_kg, p_effective_from
  )
$$;

create or replace function private.confirm_nutrition_target(
  p_target_id uuid,
  p_confirmation boolean
)
returns table (
  target_id uuid,
  status text,
  effective_from date,
  calorie_target numeric,
  protein_target_g numeric,
  carbohydrate_target_g numeric,
  fat_target_g numeric,
  formula_name text,
  formula_version text,
  age_years smallint,
  formula_sex text,
  height_cm numeric,
  weight_kg numeric,
  target_weight_kg numeric,
  current_bmi numeric,
  target_bmi numeric,
  activity_level text,
  activity_multiplier numeric,
  goal text,
  maintenance_calorie_estimate numeric,
  goal_adjustment_kcal numeric,
  requested_weekly_weight_change_kg numeric,
  applied_weekly_weight_change_kg numeric,
  estimated_goal_date date,
  safe_calorie_floor numeric,
  macro_assumptions jsonb,
  informational_disclaimer_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_target public.nutrition_targets%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  if p_confirmation is distinct from true then
    raise exception using errcode = '22023', message = 'explicit confirmation is required';
  end if;

  perform 1
  from public.profiles as profile
  where profile.user_id = v_user_id
  for update;

  select target.* into v_target
  from public.nutrition_targets as target
  where target.id = p_target_id and target.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'target not found';
  end if;
  if v_target.status = 'confirmed' then
    return query
    select
      target.id, target.status, target.effective_from,
      target.calorie_target, target.protein_target_g,
      target.carbohydrate_target_g, target.fat_target_g,
      target.formula_name, target.formula_version, target.age_years,
      target.formula_sex, target.height_cm, target.weight_kg,
      target.target_weight_kg, target.current_bmi, target.target_bmi,
      target.activity_level, target.activity_multiplier, target.goal,
      round(target.calorie_target - target.goal_adjustment_kcal, 2),
      target.goal_adjustment_kcal, target.requested_weekly_weight_change_kg,
      (target.macro_assumptions ->> 'applied_weekly_weight_change_kg')::numeric,
      target.estimated_goal_date,
      (target.macro_assumptions ->> 'safe_calorie_floor')::numeric,
      target.macro_assumptions, target.informational_disclaimer_version
    from public.nutrition_targets as target
    where target.id = v_target.id and target.user_id = v_user_id;
    return;
  end if;
  if v_target.status <> 'proposed' then
    raise exception using errcode = 'P0001', message = 'target is not proposed';
  end if;
  if v_target.target_weight_kg is null
    or v_target.current_bmi is null
    or v_target.target_bmi is null
    or v_target.formula_version <> 'locked-and-lean-msj-goal-v2' then
    raise exception using
      errcode = 'P0001',
      message = 'calculate a fresh goal-weight proposal before confirmation';
  end if;

  update public.nutrition_targets as target
  set effective_to = v_target.effective_from - 1,
      updated_at = now()
  where target.user_id = v_user_id
    and target.status = 'confirmed'
    and target.effective_to is null;

  update public.nutrition_targets as target
  set status = 'confirmed', updated_at = now()
  where target.id = v_target.id and target.user_id = v_user_id;

  update public.profiles as profile
  set onboarding_completed_at = coalesce(profile.onboarding_completed_at, now()),
      updated_at = now()
  where profile.user_id = v_user_id;

  return query
  select
    target.id,
    target.status,
    target.effective_from,
    target.calorie_target,
    target.protein_target_g,
    target.carbohydrate_target_g,
    target.fat_target_g,
    target.formula_name,
    target.formula_version,
    target.age_years,
    target.formula_sex,
    target.height_cm,
    target.weight_kg,
    target.target_weight_kg,
    target.current_bmi,
    target.target_bmi,
    target.activity_level,
    target.activity_multiplier,
    target.goal,
    round(target.calorie_target - target.goal_adjustment_kcal, 2),
    target.goal_adjustment_kcal,
    target.requested_weekly_weight_change_kg,
    (target.macro_assumptions ->> 'applied_weekly_weight_change_kg')::numeric,
    target.estimated_goal_date,
    (target.macro_assumptions ->> 'safe_calorie_floor')::numeric,
    target.macro_assumptions,
    target.informational_disclaimer_version
  from public.nutrition_targets as target
  where target.id = v_target.id and target.user_id = v_user_id;
end;
$$;

create or replace function public.confirm_nutrition_target(
  p_target_id uuid,
  p_confirmation boolean
)
returns table (
  target_id uuid,
  status text,
  effective_from date,
  calorie_target numeric,
  protein_target_g numeric,
  carbohydrate_target_g numeric,
  fat_target_g numeric,
  formula_name text,
  formula_version text,
  age_years smallint,
  formula_sex text,
  height_cm numeric,
  weight_kg numeric,
  target_weight_kg numeric,
  current_bmi numeric,
  target_bmi numeric,
  activity_level text,
  activity_multiplier numeric,
  goal text,
  maintenance_calorie_estimate numeric,
  goal_adjustment_kcal numeric,
  requested_weekly_weight_change_kg numeric,
  applied_weekly_weight_change_kg numeric,
  estimated_goal_date date,
  safe_calorie_floor numeric,
  macro_assumptions jsonb,
  informational_disclaimer_version text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.confirm_nutrition_target(
    p_target_id, p_confirmation
  )
$$;

revoke all on function private.get_goal_setup()
  from public, anon, authenticated;
revoke all on function public.get_goal_setup()
  from public, anon, authenticated;
revoke all on function private.propose_nutrition_target(
  numeric, numeric, text, numeric, date
) from public, anon, authenticated;
revoke all on function public.propose_nutrition_target(
  numeric, numeric, text, numeric, date
) from public, anon, authenticated;
revoke all on function private.confirm_nutrition_target(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.confirm_nutrition_target(uuid, boolean)
  from public, anon, authenticated;

grant execute on function private.get_goal_setup() to authenticated;
grant execute on function public.get_goal_setup() to authenticated;
grant execute on function private.propose_nutrition_target(
  numeric, numeric, text, numeric, date
) to authenticated;
grant execute on function public.propose_nutrition_target(
  numeric, numeric, text, numeric, date
) to authenticated;
grant execute on function private.confirm_nutrition_target(uuid, boolean)
  to authenticated;
grant execute on function public.confirm_nutrition_target(uuid, boolean)
  to authenticated;
