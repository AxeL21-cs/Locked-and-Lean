-- Locked and Lean Phase 3 core backend.
-- This migration is intentionally additive to the locally verified Phase 2
-- migration. User identity is always derived from auth.uid(); no write RPC
-- accepts a user_id or a client-calculated aggregate.

-- Calories-only manual data must not turn unknown macros into invented zeroes.
alter table public.food_products
  alter column protein_g drop not null,
  alter column carbohydrates_g drop not null,
  alter column fat_g drop not null;
alter table public.food_log_preview_items
  alter column protein_g drop not null,
  alter column carbohydrates_g drop not null,
  alter column fat_g drop not null;
alter table public.food_entry_items
  alter column protein_g drop not null,
  alter column carbohydrates_g drop not null,
  alter column fat_g drop not null;
alter table public.food_log_preview_revisions
  alter column total_protein_g drop not null,
  alter column total_carbohydrates_g drop not null,
  alter column total_fat_g drop not null;
alter table public.food_entries
  alter column total_protein_g drop not null,
  alter column total_carbohydrates_g drop not null,
  alter column total_fat_g drop not null,
  alter column total_protein_g drop default,
  alter column total_carbohydrates_g drop default,
  alter column total_fat_g drop default;
alter table public.daily_summaries
  alter column consumed_protein_g drop not null,
  alter column consumed_carbohydrates_g drop not null,
  alter column consumed_fat_g drop not null,
  alter column consumed_protein_g drop default,
  alter column consumed_carbohydrates_g drop default,
  alter column consumed_fat_g drop default;

alter table public.food_products
  add column macro_data_complete boolean generated always as (
    protein_g is not null and carbohydrates_g is not null and fat_g is not null
  ) stored;
alter table public.food_log_preview_items
  add column macro_data_complete boolean generated always as (
    protein_g is not null and carbohydrates_g is not null and fat_g is not null
  ) stored;
alter table public.food_entry_items
  add column macro_data_complete boolean generated always as (
    protein_g is not null and carbohydrates_g is not null and fat_g is not null
  ) stored;
alter table public.food_log_preview_revisions
  add column macro_data_complete boolean generated always as (
    total_protein_g is not null
    and total_carbohydrates_g is not null
    and total_fat_g is not null
  ) stored;
alter table public.food_entries
  add column macro_data_complete boolean generated always as (
    total_protein_g is not null
    and total_carbohydrates_g is not null
    and total_fat_g is not null
  ) stored;
alter table public.daily_summaries
  add column macro_data_complete boolean generated always as (
    consumed_protein_g is not null
    and consumed_carbohydrates_g is not null
    and consumed_fat_g is not null
  ) stored;

-- Multiple historical targets may start on the same date, but there may be
-- only one pending proposal and one open confirmed target per user.
alter table public.nutrition_targets
  drop constraint nutrition_targets_user_id_effective_from_key;
create unique index nutrition_targets_one_proposed_idx
  on public.nutrition_targets (user_id)
  where status = 'proposed';

create or replace function private.local_date_for_zone(
  p_instant timestamptz,
  p_time_zone text
)
returns date
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_instant is null then
    raise exception using errcode = '22023', message = 'timestamp is required';
  end if;
  if p_time_zone is null
    or length(p_time_zone) not between 1 and 100
    or not exists (
      select 1 from pg_catalog.pg_timezone_names as tz where tz.name = p_time_zone
    ) then
    raise exception using errcode = '22023', message = 'timezone must be a valid IANA timezone';
  end if;
  return (p_instant at time zone p_time_zone)::date;
end;
$$;

create or replace function private.rebuild_daily_summary(
  p_user_id uuid,
  p_local_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_count integer;
  v_calories numeric(10,2);
  v_protein numeric(10,3);
  v_carbohydrates numeric(10,3);
  v_fat numeric(10,3);
  v_target_id uuid;
  v_target_calories numeric(8,2);
  v_target_protein numeric(8,2);
  v_target_carbohydrates numeric(8,2);
  v_target_fat numeric(8,2);
  v_weight numeric(6,2);
begin
  select
    count(*)::integer,
    coalesce(sum(e.total_calories), 0)::numeric(10,2),
    case when count(*) filter (where not e.macro_data_complete) > 0
      then null else coalesce(sum(e.total_protein_g), 0)::numeric(10,3) end,
    case when count(*) filter (where not e.macro_data_complete) > 0
      then null else coalesce(sum(e.total_carbohydrates_g), 0)::numeric(10,3) end,
    case when count(*) filter (where not e.macro_data_complete) > 0
      then null else coalesce(sum(e.total_fat_g), 0)::numeric(10,3) end
  into v_entry_count, v_calories, v_protein, v_carbohydrates, v_fat
  from public.food_entries as e
  where e.user_id = p_user_id
    and e.local_date = p_local_date
    and e.deleted_at is null;

  select t.id, t.calorie_target, t.protein_target_g,
         t.carbohydrate_target_g, t.fat_target_g
  into v_target_id, v_target_calories, v_target_protein,
       v_target_carbohydrates, v_target_fat
  from public.nutrition_targets as t
  where t.user_id = p_user_id
    and t.status = 'confirmed'
    and t.effective_from <= p_local_date
    and (t.effective_to is null or t.effective_to >= p_local_date)
  order by t.effective_from desc, t.created_at desc
  limit 1;

  select w.weight_kg into v_weight
  from public.weight_logs as w
  where w.user_id = p_user_id and w.local_date = p_local_date
  order by w.measured_at desc, w.id desc
  limit 1;

  if v_entry_count = 0 and v_target_id is null and v_weight is null then
    delete from public.daily_summaries
    where user_id = p_user_id and local_date = p_local_date;
    return;
  end if;

  insert into public.daily_summaries (
    user_id, local_date, nutrition_target_id, entry_count,
    consumed_calories, consumed_protein_g, consumed_carbohydrates_g,
    consumed_fat_g, calorie_target, protein_target_g,
    carbohydrate_target_g, fat_target_g, weight_kg, recalculated_at
  ) values (
    p_user_id, p_local_date, v_target_id, v_entry_count,
    v_calories, v_protein, v_carbohydrates, v_fat,
    v_target_calories, v_target_protein, v_target_carbohydrates,
    v_target_fat, v_weight, now()
  )
  on conflict (user_id, local_date) do update
  set nutrition_target_id = excluded.nutrition_target_id,
      entry_count = excluded.entry_count,
      consumed_calories = excluded.consumed_calories,
      consumed_protein_g = excluded.consumed_protein_g,
      consumed_carbohydrates_g = excluded.consumed_carbohydrates_g,
      consumed_fat_g = excluded.consumed_fat_g,
      calorie_target = excluded.calorie_target,
      protein_target_g = excluded.protein_target_g,
      carbohydrate_target_g = excluded.carbohydrate_target_g,
      fat_target_g = excluded.fat_target_g,
      weight_kg = excluded.weight_kg,
      recalculated_at = excluded.recalculated_at;
end;
$$;

create or replace function private.sync_food_entry_totals_for_entry(p_entry_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.food_entries as e where e.id = p_entry_id for update;
  update public.food_entries as e
  set total_calories = totals.calories,
      total_protein_g = totals.protein_g,
      total_carbohydrates_g = totals.carbohydrates_g,
      total_fat_g = totals.fat_g,
      updated_at = now()
  from (
    select
      coalesce(sum(i.calories), 0)::numeric(10,2) as calories,
      case when count(*) filter (where not i.macro_data_complete) > 0
        then null else coalesce(sum(i.protein_g), 0)::numeric(10,3) end as protein_g,
      case when count(*) filter (where not i.macro_data_complete) > 0
        then null else coalesce(sum(i.carbohydrates_g), 0)::numeric(10,3) end as carbohydrates_g,
      case when count(*) filter (where not i.macro_data_complete) > 0
        then null else coalesce(sum(i.fat_g), 0)::numeric(10,3) end as fat_g
    from public.food_entry_items as i
    where i.food_entry_id = p_entry_id
  ) as totals
  where e.id = p_entry_id;
end;
$$;

create or replace function private.sync_food_entry_totals()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_entry_id uuid;
begin
  for v_entry_id in
    select distinct affected.food_entry_id
    from (
      select food_entry_id from new_rows
      union
      select food_entry_id from old_rows
    ) as affected
    order by affected.food_entry_id
  loop
    perform private.sync_food_entry_totals_for_entry(v_entry_id);
  end loop;
  return null;
end;
$$;

create or replace function private.sync_food_entry_totals_after_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_entry_id uuid;
begin
  for v_entry_id in
    select distinct n.food_entry_id from new_rows as n order by n.food_entry_id
  loop
    perform private.sync_food_entry_totals_for_entry(v_entry_id);
  end loop;
  return null;
end;
$$;

create or replace function private.sync_food_entry_totals_after_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_entry_id uuid;
begin
  for v_entry_id in
    select distinct o.food_entry_id from old_rows as o order by o.food_entry_id
  loop
    perform private.sync_food_entry_totals_for_entry(v_entry_id);
  end loop;
  return null;
end;
$$;

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

  return query
  select p.user_id, p.display_name, p.birth_date, p.formula_sex,
         p.height_cm, p.preferred_units, p.time_zone,
         p.onboarding_completed_at
  from public.profiles as p where p.user_id = v_user_id;
end;
$$;

create or replace function public.upsert_profile(
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
language sql
security invoker
set search_path = ''
as $$ select * from private.upsert_profile(
  p_display_name, p_birth_date, p_formula_sex, p_height_cm,
  p_preferred_units, p_time_zone
) $$;

create or replace function private.propose_nutrition_target(
  p_weight_kg numeric,
  p_activity_level text,
  p_goal text,
  p_requested_weekly_weight_change_kg numeric default null,
  p_effective_from date default null
)
returns table (
  target_id uuid, status text, effective_from date, calorie_target numeric,
  protein_target_g numeric, carbohydrate_target_g numeric, fat_target_g numeric,
  formula_name text, formula_version text, age_years smallint,
  activity_multiplier numeric, goal_adjustment_kcal numeric,
  safe_calorie_floor numeric, informational_disclaimer_version text
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
  v_rate numeric(5,3);
  v_signed_rate numeric(5,3);
  v_bmr numeric;
  v_tdee numeric;
  v_requested_adjustment numeric;
  v_applied_adjustment numeric(7,2);
  v_floor numeric(8,2);
  v_calories numeric(8,2);
  v_target_id uuid;
  v_open_effective_from date;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  select p.* into v_profile from public.profiles as p
  where p.user_id = v_user_id for update;
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
    raise exception using errcode = '22023', message = 'weight is invalid';
  end if;
  v_multiplier := case p_activity_level
    when 'sedentary' then 1.200
    when 'lightly_active' then 1.375
    when 'moderately_active' then 1.550
    when 'very_active' then 1.725
    when 'extra_active' then 1.900
    else null end;
  if v_multiplier is null then
    raise exception using errcode = '22023', message = 'activity level is invalid';
  end if;
  if p_goal not in ('lose', 'maintain', 'gain') then
    raise exception using errcode = '22023', message = 'goal is invalid';
  end if;
  if p_requested_weekly_weight_change_kg is not null
    and p_requested_weekly_weight_change_kg not between 0 and 1 then
    raise exception using errcode = '22023', message = 'requested weekly weight change is invalid';
  end if;
  v_rate := coalesce(
    p_requested_weekly_weight_change_kg,
    case p_goal when 'lose' then 0.500 when 'gain' then 0.250 else 0 end
  );
  if p_goal = 'maintain' and v_rate <> 0 then
    raise exception using errcode = '22023', message = 'maintain goal requires a zero weekly weight change';
  end if;
  v_signed_rate := case p_goal when 'lose' then -v_rate when 'gain' then v_rate else 0 end;

  select t.effective_from into v_open_effective_from
  from public.nutrition_targets as t
  where t.user_id = v_user_id and t.status = 'confirmed' and t.effective_to is null
  order by t.effective_from desc limit 1;
  v_effective_from := coalesce(
    p_effective_from,
    greatest(v_local_today, coalesce(v_open_effective_from + 1, v_local_today))
  );
  if v_effective_from < v_local_today
    or (v_open_effective_from is not null and v_effective_from <= v_open_effective_from) then
    raise exception using errcode = '22023', message = 'effective date must follow the current target';
  end if;

  v_bmr := 10 * p_weight_kg + 6.25 * v_profile.height_cm - 5 * v_age
    + case v_profile.formula_sex when 'male' then 5 else -161 end;
  v_tdee := v_bmr * v_multiplier;
  v_requested_adjustment := v_signed_rate * 7700 / 7;
  v_floor := case v_profile.formula_sex when 'male' then 1500 else 1200 end;
  v_calories := round(greatest(v_floor, v_tdee + v_requested_adjustment), 0);
  v_applied_adjustment := round(v_calories - v_tdee, 2);

  delete from public.nutrition_targets as t
  where t.user_id = v_user_id and t.status = 'proposed';

  insert into public.nutrition_targets (
    user_id, status, effective_from, calorie_target, protein_target_g,
    carbohydrate_target_g, fat_target_g, formula_name, formula_version,
    age_years, formula_sex, height_cm, weight_kg, activity_level,
    activity_multiplier, goal, goal_adjustment_kcal,
    requested_weekly_weight_change_kg, macro_assumptions,
    informational_disclaimer_version
  ) values (
    v_user_id, 'proposed', v_effective_from, v_calories,
    round(v_calories * 0.25 / 4, 2), round(v_calories * 0.45 / 4, 2),
    round(v_calories * 0.30 / 9, 2), 'Mifflin-St Jeor',
    'locked-and-lean-msj-v1', v_age, v_profile.formula_sex,
    v_profile.height_cm, p_weight_kg, p_activity_level, v_multiplier,
    p_goal, v_applied_adjustment, v_signed_rate,
    jsonb_build_object(
      'version', 'balanced-macros-v1',
      'protein_calorie_fraction', 0.25,
      'carbohydrate_calorie_fraction', 0.45,
      'fat_calorie_fraction', 0.30,
      'kilocalories_per_kg', 7700,
      'safe_calorie_floor', v_floor,
      'default_rate_applied', p_requested_weekly_weight_change_kg is null
    ),
    'informational-not-medical-device-v1'
  ) returning id into v_target_id;

  return query
  select t.id, t.status, t.effective_from, t.calorie_target,
         t.protein_target_g, t.carbohydrate_target_g, t.fat_target_g,
         t.formula_name, t.formula_version, t.age_years,
         t.activity_multiplier, t.goal_adjustment_kcal,
         (t.macro_assumptions ->> 'safe_calorie_floor')::numeric,
         t.informational_disclaimer_version
  from public.nutrition_targets as t
  where t.id = v_target_id and t.user_id = v_user_id;
end;
$$;

create or replace function public.propose_nutrition_target(
  p_weight_kg numeric,
  p_activity_level text,
  p_goal text,
  p_requested_weekly_weight_change_kg numeric default null,
  p_effective_from date default null
)
returns table (
  target_id uuid, status text, effective_from date, calorie_target numeric,
  protein_target_g numeric, carbohydrate_target_g numeric, fat_target_g numeric,
  formula_name text, formula_version text, age_years smallint,
  activity_multiplier numeric, goal_adjustment_kcal numeric,
  safe_calorie_floor numeric, informational_disclaimer_version text
)
language sql
security invoker
set search_path = ''
as $$ select * from private.propose_nutrition_target(
  p_weight_kg, p_activity_level, p_goal,
  p_requested_weekly_weight_change_kg, p_effective_from
) $$;

create or replace function private.confirm_nutrition_target(
  p_target_id uuid,
  p_confirmation boolean
)
returns table (
  target_id uuid, status text, effective_from date, calorie_target numeric,
  protein_target_g numeric, carbohydrate_target_g numeric, fat_target_g numeric,
  formula_name text, formula_version text, age_years smallint,
  activity_multiplier numeric, goal_adjustment_kcal numeric,
  safe_calorie_floor numeric, informational_disclaimer_version text
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
  select t.* into v_target from public.nutrition_targets as t
  where t.id = p_target_id and t.user_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'target not found';
  end if;
  if v_target.status <> 'proposed' then
    raise exception using errcode = 'P0001', message = 'target is not proposed';
  end if;

  update public.nutrition_targets as t
  set effective_to = v_target.effective_from - 1, updated_at = now()
  where t.user_id = v_user_id and t.status = 'confirmed' and t.effective_to is null;
  update public.nutrition_targets as t
  set status = 'confirmed', updated_at = now()
  where t.id = v_target.id and t.user_id = v_user_id;
  update public.profiles as p
  set onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      updated_at = now()
  where p.user_id = v_user_id;

  return query
  select t.id, t.status, t.effective_from, t.calorie_target,
         t.protein_target_g, t.carbohydrate_target_g, t.fat_target_g,
         t.formula_name, t.formula_version, t.age_years,
         t.activity_multiplier, t.goal_adjustment_kcal,
         (t.macro_assumptions ->> 'safe_calorie_floor')::numeric,
         t.informational_disclaimer_version
  from public.nutrition_targets as t
  where t.id = v_target.id and t.user_id = v_user_id;
end;
$$;

create or replace function public.confirm_nutrition_target(
  p_target_id uuid,
  p_confirmation boolean
)
returns table (
  target_id uuid, status text, effective_from date, calorie_target numeric,
  protein_target_g numeric, carbohydrate_target_g numeric, fat_target_g numeric,
  formula_name text, formula_version text, age_years smallint,
  activity_multiplier numeric, goal_adjustment_kcal numeric,
  safe_calorie_floor numeric, informational_disclaimer_version text
)
language sql
security invoker
set search_path = ''
as $$ select * from private.confirm_nutrition_target(p_target_id, p_confirmation) $$;

create or replace function private.create_manual_food_log_preview(
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
  p_original_description text,
  p_items jsonb
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_preview_id uuid := gen_random_uuid();
  v_presented_at timestamptz := clock_timestamp();
  v_item_count integer;
  v_calories numeric(10,2);
  v_protein numeric(10,3);
  v_carbohydrates numeric(10,3);
  v_fat numeric(10,3);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  if p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception using errcode = '22023', message = 'meal type is invalid';
  end if;
  perform private.local_date_for_zone(p_consumed_at, p_time_zone);
  if p_original_description is null
    or length(btrim(p_original_description)) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'description is invalid';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'manual preview requires 1 to 100 items';
  end if;

  insert into public.chatgpt_log_previews (
    id, user_id, source_kind, status, revision_number, expires_at
  ) values (
    v_preview_id, v_user_id, 'manual', 'draft', 1, v_presented_at + interval '24 hours'
  );

  insert into public.food_log_preview_revisions (
    preview_id, revision_number, user_id, meal_type, consumed_at, time_zone,
    original_description, total_calories, total_protein_g,
    total_carbohydrates_g, total_fat_g
  ) values (
    v_preview_id, 1, v_user_id, p_meal_type, p_consumed_at, p_time_zone,
    btrim(p_original_description), 0, null, null, null
  );

  insert into public.food_log_preview_items (
    preview_id, revision_number, user_id, ordinal, component_role,
    food_product_id, food_name, brand_name, quantity, unit,
    serving_description, serving_weight_g, calories, protein_g,
    carbohydrates_g, fat_g, provider, provider_identifier,
    is_estimated, confidence, uncertainty, market_country_code
  )
  select
    v_preview_id,
    1,
    v_user_id,
    element.ordinal::smallint,
    'standalone',
    item.food_product_id,
    btrim(item.food_name),
    nullif(btrim(item.brand_name), ''),
    item.quantity,
    btrim(item.unit),
    nullif(btrim(item.serving_description), ''),
    item.serving_weight_g,
    item.calories,
    item.protein_g,
    item.carbohydrates_g,
    item.fat_g,
    'manual_user_input_v1',
    null,
    coalesce(item.is_estimated, false),
    item.confidence,
    coalesce(item.uncertainty, '[]'::jsonb),
    'PH'
  from jsonb_array_elements(p_items) with ordinality as element(value, ordinal)
  cross join lateral jsonb_to_record(element.value) as item(
    food_name text,
    brand_name text,
    quantity numeric,
    unit text,
    serving_description text,
    serving_weight_g numeric,
    calories numeric,
    protein_g numeric,
    carbohydrates_g numeric,
    fat_g numeric,
    food_product_id uuid,
    provider text,
    provider_identifier text,
    is_estimated boolean,
    confidence numeric,
    uncertainty jsonb
  )
  where item.food_name is not null
    and length(btrim(item.food_name)) between 1 and 300
    and item.quantity > 0
    and item.unit is not null
    and length(btrim(item.unit)) between 1 and 80
    and item.calories between 0 and 100000
    and (item.protein_g is null or item.protein_g between 0 and 10000)
    and (item.carbohydrates_g is null or item.carbohydrates_g between 0 and 10000)
    and (item.fat_g is null or item.fat_g between 0 and 10000)
    and (item.serving_weight_g is null or item.serving_weight_g > 0)
    and (item.confidence is null or item.confidence between 0 and 1)
    and (
      item.uncertainty is null
      or jsonb_typeof(item.uncertainty) in ('array', 'object')
    )
    and (
      item.food_product_id is null
      or exists (
        select 1 from public.food_products as product
        where product.id = item.food_product_id
          and (product.user_id is null or product.user_id = v_user_id)
      )
    );

  get diagnostics v_item_count = row_count;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception using errcode = '22023', message = 'one or more manual preview items are invalid';
  end if;

  select
    coalesce(sum(i.calories), 0)::numeric(10,2),
    case when count(*) filter (where not i.macro_data_complete) > 0
      then null else coalesce(sum(i.protein_g), 0)::numeric(10,3) end,
    case when count(*) filter (where not i.macro_data_complete) > 0
      then null else coalesce(sum(i.carbohydrates_g), 0)::numeric(10,3) end,
    case when count(*) filter (where not i.macro_data_complete) > 0
      then null else coalesce(sum(i.fat_g), 0)::numeric(10,3) end
  into v_calories, v_protein, v_carbohydrates, v_fat
  from public.food_log_preview_items as i
  where i.preview_id = v_preview_id and i.revision_number = 1
    and i.user_id = v_user_id;

  update public.food_log_preview_revisions as revision
  set total_calories = v_calories,
      total_protein_g = v_protein,
      total_carbohydrates_g = v_carbohydrates,
      total_fat_g = v_fat,
      presented_at = v_presented_at,
      server_calculated_at = v_presented_at
  where revision.preview_id = v_preview_id
    and revision.revision_number = 1
    and revision.user_id = v_user_id;

  update public.chatgpt_log_previews as preview
  set status = 'ready', last_presented_at = v_presented_at,
      updated_at = v_presented_at
  where preview.id = v_preview_id and preview.user_id = v_user_id;

  return query
  select p.id, p.revision_number, p.status, p.last_presented_at,
         p.expires_at, r.meal_type, r.consumed_at, r.time_zone,
         r.original_description, r.total_calories, r.total_protein_g,
         r.total_carbohydrates_g, r.total_fat_g, r.macro_data_complete
  from public.chatgpt_log_previews as p
  join public.food_log_preview_revisions as r
    on r.preview_id = p.id and r.revision_number = p.revision_number
  where p.id = v_preview_id and p.user_id = v_user_id;
end;
$$;

create or replace function public.create_manual_food_log_preview(
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
  p_original_description text,
  p_items jsonb
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean
)
language sql
security invoker
set search_path = ''
as $$ select * from private.create_manual_food_log_preview(
  p_meal_type, p_consumed_at, p_time_zone, p_original_description, p_items
) $$;

create or replace function private.save_food_for_reuse(
  p_canonical_name text,
  p_brand_name text,
  p_barcode text,
  p_serving_quantity numeric,
  p_serving_unit text,
  p_serving_weight_g numeric,
  p_calories numeric,
  p_confirmation boolean,
  p_protein_g numeric default null,
  p_carbohydrates_g numeric default null,
  p_fat_g numeric default null
)
returns table (
  food_product_id uuid, canonical_name text, brand_name text, barcode text,
  market_country_code text, serving_quantity numeric, serving_unit text,
  serving_weight_g numeric, calories numeric, protein_g numeric,
  carbohydrates_g numeric, fat_g numeric, macro_data_complete boolean,
  provider text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_food_product_id uuid;
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
  if p_canonical_name is null or length(btrim(p_canonical_name)) not between 1 and 300
    or p_serving_quantity is null or p_serving_quantity <= 0
    or p_serving_unit is null or length(btrim(p_serving_unit)) not between 1 and 80
    or p_calories is null or p_calories not between 0 and 100000
    or (p_barcode is not null and p_barcode !~ '^[0-9]{8,14}$')
    or (p_serving_weight_g is not null and p_serving_weight_g <= 0)
    or (p_protein_g is not null and p_protein_g not between 0 and 10000)
    or (p_carbohydrates_g is not null and p_carbohydrates_g not between 0 and 10000)
    or (p_fat_g is not null and p_fat_g not between 0 and 10000) then
    raise exception using errcode = '22023', message = 'saved food input is invalid';
  end if;

  insert into public.food_products (
    user_id, canonical_name, brand_name, barcode, market_country_code,
    serving_quantity, serving_unit, serving_weight_g, calories, protein_g,
    carbohydrates_g, fat_g, provider, provider_version, is_estimated,
    confidence, uncertainty
  ) values (
    v_user_id, btrim(p_canonical_name), nullif(btrim(p_brand_name), ''),
    p_barcode, 'PH', p_serving_quantity, btrim(p_serving_unit),
    p_serving_weight_g, p_calories, p_protein_g, p_carbohydrates_g,
    p_fat_g, 'user_manual', 'user_manual_v1', false, null,
    case when p_protein_g is null or p_carbohydrates_g is null or p_fat_g is null
      then '[{"code":"macros_unknown","message":"One or more macros were not supplied."}]'::jsonb
      else '[]'::jsonb end
  ) returning id into v_food_product_id;

  return query
  select p.id, p.canonical_name, p.brand_name, p.barcode,
         p.market_country_code, p.serving_quantity, p.serving_unit,
         p.serving_weight_g, p.calories, p.protein_g,
         p.carbohydrates_g, p.fat_g, p.macro_data_complete, p.provider
  from public.food_products as p
  where p.id = v_food_product_id and p.user_id = v_user_id;
end;
$$;

create or replace function public.save_food_for_reuse(
  p_canonical_name text,
  p_brand_name text,
  p_barcode text,
  p_serving_quantity numeric,
  p_serving_unit text,
  p_serving_weight_g numeric,
  p_calories numeric,
  p_confirmation boolean,
  p_protein_g numeric default null,
  p_carbohydrates_g numeric default null,
  p_fat_g numeric default null
)
returns table (
  food_product_id uuid, canonical_name text, brand_name text, barcode text,
  market_country_code text, serving_quantity numeric, serving_unit text,
  serving_weight_g numeric, calories numeric, protein_g numeric,
  carbohydrates_g numeric, fat_g numeric, macro_data_complete boolean,
  provider text
)
language sql
security invoker
set search_path = ''
as $$ select * from private.save_food_for_reuse(
  p_canonical_name, p_brand_name, p_barcode, p_serving_quantity,
  p_serving_unit, p_serving_weight_g, p_calories, p_confirmation,
  p_protein_g, p_carbohydrates_g, p_fat_g
) $$;

create or replace function private.record_weight(
  p_measured_at timestamptz,
  p_time_zone text,
  p_weight_kg numeric,
  p_idempotency_key text
)
returns table (
  weight_log_id uuid, reused boolean, measured_at timestamptz,
  local_date date, time_zone text, weight_kg numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id text := (select auth.jwt()) ->> 'client_id';
  v_local_date date;
  v_id uuid;
  v_existing public.weight_logs%rowtype;
  v_reused boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if v_client_id is not null and not exists (
    select 1 from private.oauth_client_action_policies as policy
    where policy.client_id = v_client_id and policy.action = 'record_weight'
      and policy.enabled
  ) then
    raise exception using errcode = '42501', message = 'oauth client is not authorized for this action';
  end if;
  if p_weight_kg is null or p_weight_kg not between 20 and 500 then
    raise exception using errcode = '22023', message = 'weight is invalid';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'idempotency key is invalid';
  end if;
  v_local_date := private.local_date_for_zone(p_measured_at, p_time_zone);

  insert into public.weight_logs (
    user_id, measured_at, local_date, time_zone, weight_kg, idempotency_key
  ) values (
    v_user_id, p_measured_at, v_local_date, p_time_zone,
    p_weight_kg, p_idempotency_key
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    v_reused := true;
    select w.* into strict v_existing from public.weight_logs as w
    where w.user_id = v_user_id and w.idempotency_key = p_idempotency_key
    for update;
    if v_existing.measured_at is distinct from p_measured_at
      or v_existing.time_zone is distinct from p_time_zone
      or v_existing.weight_kg is distinct from p_weight_kg
      or v_existing.local_date is distinct from v_local_date then
      raise exception using errcode = '23505', message = 'idempotency key reused with different request';
    end if;
    v_id := v_existing.id;
  end if;

  return query
  select w.id, v_reused, w.measured_at, w.local_date, w.time_zone, w.weight_kg
  from public.weight_logs as w
  where w.id = v_id and w.user_id = v_user_id;
end;
$$;

create or replace function public.record_weight(
  p_measured_at timestamptz,
  p_time_zone text,
  p_weight_kg numeric,
  p_idempotency_key text
)
returns table (
  weight_log_id uuid, reused boolean, measured_at timestamptz,
  local_date date, time_zone text, weight_kg numeric
)
language sql
security invoker
set search_path = ''
as $$ select * from private.record_weight(
  p_measured_at, p_time_zone, p_weight_kg, p_idempotency_key
) $$;

create or replace function private.delete_food_entry(
  p_entry_id uuid,
  p_confirmation boolean
)
returns table (entry_id uuid, deleted_at timestamptz, local_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id text := (select auth.jwt()) ->> 'client_id';
  v_entry public.food_entries%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if v_client_id is not null and not exists (
    select 1 from private.oauth_client_action_policies as policy
    where policy.client_id = v_client_id and policy.action = 'delete_food_entry'
      and policy.enabled
  ) then
    raise exception using errcode = '42501', message = 'oauth client is not authorized for this action';
  end if;
  if p_confirmation is distinct from true then
    raise exception using errcode = '22023', message = 'explicit confirmation is required';
  end if;
  select e.* into v_entry from public.food_entries as e
  where e.id = p_entry_id and e.user_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'entry not found';
  end if;
  if v_entry.deleted_at is null then
    update public.food_entries as e
    set deleted_at = clock_timestamp(), updated_at = clock_timestamp()
    where e.id = v_entry.id and e.user_id = v_user_id
    returning e.* into v_entry;
  end if;
  return query select v_entry.id, v_entry.deleted_at, v_entry.local_date;
end;
$$;

create or replace function public.delete_food_entry(
  p_entry_id uuid,
  p_confirmation boolean
)
returns table (entry_id uuid, deleted_at timestamptz, local_date date)
language sql
security invoker
set search_path = ''
as $$ select * from private.delete_food_entry(p_entry_id, p_confirmation) $$;

-- Preserve the fully tested Phase 2 implementation under an ungranted name
-- for auditability. The replacement adds one narrowly reviewed first-party
-- branch only after it proves the owned source is manual/barcode/saved_food.
-- ChatGPT and every OAuth token retain the exact client/action default deny.
alter function private.confirm_food_log(uuid, integer, boolean, text)
  rename to confirm_food_log_phase_2_core;

create or replace function private.confirm_food_log(
  p_preview_id uuid,
  p_confirmed_revision integer,
  p_confirmation boolean,
  p_idempotency_key text
)
returns table (
  entry_id uuid,
  reused boolean,
  local_date date,
  total_calories numeric,
  total_protein_g numeric,
  total_carbohydrates_g numeric,
  total_fat_g numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id text := (select auth.jwt()) ->> 'client_id';
  v_idempotency public.mcp_idempotency_keys%rowtype;
  v_preview public.chatgpt_log_previews%rowtype;
  v_revision public.food_log_preview_revisions%rowtype;
  v_entry_id uuid;
  v_local_date date;
  v_item_count integer;
  v_calories numeric(10,2);
  v_protein numeric(10,3);
  v_carbohydrates numeric(10,3);
  v_fat numeric(10,3);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_confirmation is distinct from true then
    raise exception using errcode = '22023', message = 'explicit confirmation is required';
  end if;
  if p_confirmed_revision is null or p_confirmed_revision < 1 then
    raise exception using errcode = '22023', message = 'confirmed revision is invalid';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'idempotency key is invalid';
  end if;

  select p.* into v_preview
  from public.chatgpt_log_previews as p
  where p.id = p_preview_id and p.user_id = v_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'preview not found';
  end if;
  if v_client_id is null and v_preview.source_kind not in ('manual', 'barcode', 'saved_food') then
    raise exception using
      errcode = '42501',
      message = 'oauth client is not authorized for this action';
  end if;
  if v_client_id is not null and not exists (
    select 1 from private.oauth_client_action_policies as policy
    where policy.client_id = v_client_id
      and policy.action = 'confirm_food_log'
      and policy.enabled
  ) then
    raise exception using
      errcode = '42501',
      message = 'oauth client is not authorized for this action';
  end if;

  insert into public.mcp_idempotency_keys (
    user_id, operation, idempotency_key, preview_id,
    confirmed_revision, confirmation, status
  ) values (
    v_user_id, 'confirm_food_log', p_idempotency_key, p_preview_id,
    p_confirmed_revision, true, 'processing'
  )
  on conflict (user_id, operation, idempotency_key) do nothing;

  select k.* into strict v_idempotency
  from public.mcp_idempotency_keys as k
  where k.user_id = v_user_id
    and k.operation = 'confirm_food_log'
    and k.idempotency_key = p_idempotency_key
  for update;
  if v_idempotency.preview_id is distinct from p_preview_id
    or v_idempotency.confirmed_revision is distinct from p_confirmed_revision
    or v_idempotency.confirmation is distinct from true then
    raise exception using errcode = '23505', message = 'idempotency key reused with different request';
  end if;

  if v_idempotency.status = 'completed' then
    insert into public.oauth_action_audit (
      user_id, oauth_client_id, action, outcome, preview_id,
      entry_id, idempotency_outcome
    ) values (
      v_user_id, v_client_id, 'confirm_food_log', 'succeeded',
      v_idempotency.preview_id, v_idempotency.result_entry_id, 'reused'
    );
    return query
    select e.id, true, e.local_date, e.total_calories,
           e.total_protein_g, e.total_carbohydrates_g, e.total_fat_g
    from public.food_entries as e
    where e.id = v_idempotency.result_entry_id and e.user_id = v_user_id;
    return;
  end if;

  select p.* into v_preview
  from public.chatgpt_log_previews as p
  where p.id = p_preview_id and p.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'preview not found';
  end if;
  if v_preview.status <> 'ready' then
    raise exception using errcode = 'P0001', message = 'preview is not confirmable';
  end if;
  if v_preview.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'preview has expired';
  end if;
  if v_preview.revision_number <> p_confirmed_revision then
    raise exception using errcode = 'P0001', message = 'stale preview revision';
  end if;
  if v_preview.last_presented_at is null then
    raise exception using errcode = 'P0001', message = 'preview has not been presented';
  end if;

  select r.* into strict v_revision
  from public.food_log_preview_revisions as r
  where r.preview_id = v_preview.id
    and r.revision_number = v_preview.revision_number
    and r.user_id = v_user_id;
  if v_revision.presented_at is null
    or v_revision.presented_at <> v_preview.last_presented_at then
    raise exception using errcode = 'P0001', message = 'current preview revision was not presented';
  end if;
  v_local_date := private.local_date_for_zone(v_revision.consumed_at, v_revision.time_zone);

  select
    count(*)::integer,
    coalesce(sum(i.calories), 0)::numeric(10,2),
    case when count(*) filter (where not i.macro_data_complete) > 0
      then null else coalesce(sum(i.protein_g), 0)::numeric(10,3) end,
    case when count(*) filter (where not i.macro_data_complete) > 0
      then null else coalesce(sum(i.carbohydrates_g), 0)::numeric(10,3) end,
    case when count(*) filter (where not i.macro_data_complete) > 0
      then null else coalesce(sum(i.fat_g), 0)::numeric(10,3) end
  into v_item_count, v_calories, v_protein, v_carbohydrates, v_fat
  from public.food_log_preview_items as i
  where i.preview_id = v_preview.id
    and i.revision_number = v_preview.revision_number
    and i.user_id = v_user_id;
  if v_item_count < 1 then
    raise exception using errcode = 'P0001', message = 'preview has no items';
  end if;

  v_entry_id := gen_random_uuid();
  insert into public.food_entries (
    id, user_id, source_preview_id, source_kind, meal_type,
    consumed_at, local_date, time_zone, original_description,
    total_protein_g, total_carbohydrates_g, total_fat_g
  ) values (
    v_entry_id, v_user_id, v_preview.id, v_preview.source_kind,
    v_revision.meal_type, v_revision.consumed_at, v_local_date,
    v_revision.time_zone, v_revision.original_description, null, null, null
  );

  insert into public.food_entry_items (
    id, food_entry_id, user_id, ordinal, source_preview_item_id,
    parent_source_preview_item_id, parent_entry_item_id, component_role,
    food_product_id, restaurant_chain_id, restaurant_menu_item_id,
    food_name, brand_name, restaurant_chain_name, restaurant_item_name,
    quantity, unit, serving_description, serving_weight_g, calories,
    protein_g, carbohydrates_g, fat_g, provider, provider_identifier,
    provider_version, provider_retrieved_at, attribution,
    market_country_code, is_estimated, confidence, uncertainty
  )
  select
    i.id, v_entry_id, v_user_id, i.ordinal, i.id,
    i.parent_preview_item_id, i.parent_preview_item_id, i.component_role,
    i.food_product_id, i.restaurant_chain_id, i.restaurant_menu_item_id,
    i.food_name, i.brand_name, i.restaurant_chain_name, i.restaurant_item_name,
    i.quantity, i.unit, i.serving_description, i.serving_weight_g, i.calories,
    i.protein_g, i.carbohydrates_g, i.fat_g, i.provider,
    i.provider_identifier, i.provider_version, i.provider_retrieved_at,
    i.attribution, i.market_country_code, i.is_estimated,
    i.confidence, i.uncertainty
  from public.food_log_preview_items as i
  where i.preview_id = v_preview.id
    and i.revision_number = v_preview.revision_number
    and i.user_id = v_user_id
  order by i.ordinal;

  if not exists (
    select 1 from public.food_entries as e
    where e.id = v_entry_id
      and e.total_calories = v_calories
      and e.total_protein_g is not distinct from v_protein
      and e.total_carbohydrates_g is not distinct from v_carbohydrates
      and e.total_fat_g is not distinct from v_fat
  ) then
    raise exception using errcode = 'P0001', message = 'entry total recalculation failed';
  end if;

  update public.chatgpt_log_previews
  set status = 'confirmed', user_confirmed_revision = p_confirmed_revision,
      confirmation_received_at = now(), confirmed_entry_id = v_entry_id,
      updated_at = now()
  where id = v_preview.id and user_id = v_user_id;

  update public.mcp_idempotency_keys
  set status = 'completed', result_entry_id = v_entry_id,
      response = jsonb_build_object(
        'entry_id', v_entry_id, 'local_date', v_local_date,
        'total_calories', v_calories, 'total_protein_g', v_protein,
        'total_carbohydrates_g', v_carbohydrates, 'total_fat_g', v_fat
      ),
      completed_at = now()
  where id = v_idempotency.id;

  insert into public.oauth_action_audit (
    user_id, oauth_client_id, action, outcome, preview_id,
    entry_id, idempotency_outcome
  ) values (
    v_user_id, v_client_id, 'confirm_food_log', 'succeeded',
    v_preview.id, v_entry_id, 'created'
  );

  return query
  select e.id, false, e.local_date, e.total_calories,
         e.total_protein_g, e.total_carbohydrates_g, e.total_fat_g
  from public.food_entries as e
  where e.id = v_entry_id and e.user_id = v_user_id;
end;
$$;

create or replace function public.confirm_food_log(
  p_preview_id uuid,
  p_confirmed_revision integer,
  p_confirmation boolean,
  p_idempotency_key text
)
returns table (
  entry_id uuid,
  reused boolean,
  local_date date,
  total_calories numeric,
  total_protein_g numeric,
  total_carbohydrates_g numeric,
  total_fat_g numeric
)
language sql
security invoker
set search_path = ''
as $$ select * from private.confirm_food_log(
  p_preview_id, p_confirmed_revision, p_confirmation, p_idempotency_key
) $$;

-- Revoke inherited/default function access again after every Phase 3 function,
-- then grant only the explicitly reviewed public/private bridge pairs.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

grant usage on schema private to authenticated;
grant execute on function private.confirm_food_log(uuid, integer, boolean, text) to authenticated;
grant execute on function private.rebuild_my_daily_summaries(date, date) to authenticated;
grant execute on function private.upsert_profile(text, date, text, numeric, text, text) to authenticated;
grant execute on function private.propose_nutrition_target(numeric, text, text, numeric, date) to authenticated;
grant execute on function private.confirm_nutrition_target(uuid, boolean) to authenticated;
grant execute on function private.create_manual_food_log_preview(text, timestamptz, text, text, jsonb) to authenticated;
grant execute on function private.save_food_for_reuse(text, text, text, numeric, text, numeric, numeric, boolean, numeric, numeric, numeric) to authenticated;
grant execute on function private.record_weight(timestamptz, text, numeric, text) to authenticated;
grant execute on function private.delete_food_entry(uuid, boolean) to authenticated;

grant execute on function public.confirm_food_log(uuid, integer, boolean, text) to authenticated;
grant execute on function public.rebuild_my_daily_summaries(date, date) to authenticated;
grant execute on function public.upsert_profile(text, date, text, numeric, text, text) to authenticated;
grant execute on function public.propose_nutrition_target(numeric, text, text, numeric, date) to authenticated;
grant execute on function public.confirm_nutrition_target(uuid, boolean) to authenticated;
grant execute on function public.create_manual_food_log_preview(text, timestamptz, text, text, jsonb) to authenticated;
grant execute on function public.save_food_for_reuse(text, text, text, numeric, text, numeric, numeric, boolean, numeric, numeric, numeric) to authenticated;
grant execute on function public.record_weight(timestamptz, text, numeric, text) to authenticated;
grant execute on function public.delete_food_entry(uuid, boolean) to authenticated;
