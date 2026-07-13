-- Locked and Lean Phase 5 Calendar and Progress backend.
-- History reads derive identity from auth.uid(), use Asia/Manila local dates,
-- and read only immutable confirmed snapshots that are not soft-deleted.

alter table public.chatgpt_log_previews
  add column history_intent text not null default 'new'
    constraint chatgpt_log_previews_history_intent_value_check check (
    history_intent in ('new', 'copy', 'replace')
  ),
  add column source_food_entry_id uuid,
  add constraint chatgpt_log_previews_source_entry_owner_fkey
    foreign key (source_food_entry_id, user_id)
    references public.food_entries (id, user_id)
    on delete set null (source_food_entry_id),
  add constraint chatgpt_log_previews_history_intent_check check (
    (history_intent = 'new' and source_food_entry_id is null)
    or (history_intent in ('copy', 'replace') and source_food_entry_id is not null)
  );

create index chatgpt_log_previews_source_food_entry_idx
  on public.chatgpt_log_previews (source_food_entry_id)
  where source_food_entry_id is not null;

-- Active history range scans use this existing predicate on every read path.
-- The Phase 2 index already has the correct leading equality/range columns;
-- include totals so range summaries can often use an index-only scan.
create index food_entries_user_manila_history_cover_idx
  on public.food_entries (
    user_id,
    ((consumed_at at time zone 'Asia/Manila')::date),
    consumed_at,
    id
  )
  include (
    meal_type, source_kind, total_calories, total_protein_g,
    total_carbohydrates_g, total_fat_g, macro_data_complete
  )
  where deleted_at is null;

create index weight_logs_user_manila_date_idx
  on public.weight_logs (
    user_id,
    ((measured_at at time zone 'Asia/Manila')::date),
    measured_at,
    id
  ) include (weight_kg);

-- Phase 5 fixes the product diary boundary to the configured country timezone.
-- The parameter remains for API compatibility, but callers may no longer
-- choose a different local-date authority.
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
  if p_time_zone is distinct from 'Asia/Manila' then
    raise exception using errcode = '22023',
      message = 'timezone must be Asia/Manila for Philippine diary dates';
  end if;
  return (p_instant at time zone 'Asia/Manila')::date;
end;
$$;

create or replace function private.validate_manila_date_range(
  p_start_date date,
  p_end_date date,
  p_max_days integer
)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_start_date is null or p_end_date is null then
    raise exception using errcode = '22023', message = 'start and end dates are required';
  end if;
  if p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'end date must not be before start date';
  end if;
  if p_end_date - p_start_date + 1 > p_max_days then
    raise exception using errcode = '22023',
      message = format('date range must not exceed %s days', p_max_days);
  end if;
end;
$$;

create or replace function private.require_history_read_action(p_action text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_id text := (select auth.jwt()) ->> 'client_id';
begin
  if p_action not in (
    'get_calendar_history',
    'get_day_history',
    'get_weight_trend',
    'get_progress_summary'
  ) then
    raise exception using errcode = '42501', message = 'history action is not reviewable';
  end if;
  if v_client_id is not null and not exists (
    select 1
    from private.oauth_client_action_policies as policy
    where policy.client_id = v_client_id
      and policy.action = p_action
      and policy.enabled
  ) then
    raise exception using errcode = '42501',
      message = 'oauth client is not authorized for this history action';
  end if;
end;
$$;

create or replace function private.get_calendar_history(
  p_start_date date,
  p_end_date date
)
returns table (
  local_date date,
  entry_count integer,
  consumed_calories numeric,
  consumed_protein_g numeric,
  consumed_carbohydrates_g numeric,
  consumed_fat_g numeric,
  macro_data_complete boolean,
  calorie_target numeric,
  protein_target_g numeric,
  carbohydrate_target_g numeric,
  fat_target_g numeric,
  weight_kg numeric,
  has_entries boolean,
  manila_time_zone text,
  server_calculated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_calculated_at timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform private.require_history_read_action('get_calendar_history');
  perform private.validate_manila_date_range(p_start_date, p_end_date, 62);

  return query
  with days as (
    select day::date as local_date
    from generate_series(p_start_date, p_end_date, interval '1 day') as day
  ), entry_rollup as (
    select
      day.local_date,
      count(entry.id)::integer as entry_count,
      coalesce(sum(entry.total_calories), 0)::numeric(10,2) as consumed_calories,
      case
        when count(entry.id) = 0 then 0::numeric(10,3)
        when bool_and(entry.macro_data_complete)
          then coalesce(sum(entry.total_protein_g), 0)::numeric(10,3)
        else null::numeric
      end as consumed_protein_g,
      case
        when count(entry.id) = 0 then 0::numeric(10,3)
        when bool_and(entry.macro_data_complete)
          then coalesce(sum(entry.total_carbohydrates_g), 0)::numeric(10,3)
        else null::numeric
      end as consumed_carbohydrates_g,
      case
        when count(entry.id) = 0 then 0::numeric(10,3)
        when bool_and(entry.macro_data_complete)
          then coalesce(sum(entry.total_fat_g), 0)::numeric(10,3)
        else null::numeric
      end as consumed_fat_g,
      coalesce(bool_and(entry.macro_data_complete), true) as macro_data_complete
    from days as day
    left join public.food_entries as entry
      on entry.user_id = v_user_id
     and (entry.consumed_at at time zone 'Asia/Manila')::date = day.local_date
     and entry.deleted_at is null
    group by day.local_date
  )
  select
    rollup.local_date,
    rollup.entry_count,
    rollup.consumed_calories,
    rollup.consumed_protein_g,
    rollup.consumed_carbohydrates_g,
    rollup.consumed_fat_g,
    rollup.macro_data_complete,
    target.calorie_target,
    target.protein_target_g,
    target.carbohydrate_target_g,
    target.fat_target_g,
    weight.weight_kg,
    rollup.entry_count > 0,
    'Asia/Manila'::text,
    v_calculated_at
  from entry_rollup as rollup
  left join lateral (
    select
      nutrition.calorie_target,
      nutrition.protein_target_g,
      nutrition.carbohydrate_target_g,
      nutrition.fat_target_g
    from public.nutrition_targets as nutrition
    where nutrition.user_id = v_user_id
      and nutrition.status = 'confirmed'
      and nutrition.effective_from <= rollup.local_date
      and (nutrition.effective_to is null or nutrition.effective_to >= rollup.local_date)
    order by nutrition.effective_from desc, nutrition.created_at desc
    limit 1
  ) as target on true
  left join lateral (
    select log.weight_kg
    from public.weight_logs as log
    where log.user_id = v_user_id
      and (log.measured_at at time zone 'Asia/Manila')::date = rollup.local_date
    order by log.measured_at desc, log.id desc
    limit 1
  ) as weight on true
  order by rollup.local_date;
end;
$$;

create or replace function public.get_calendar_history(
  p_start_date date,
  p_end_date date
)
returns table (
  local_date date, entry_count integer, consumed_calories numeric,
  consumed_protein_g numeric, consumed_carbohydrates_g numeric,
  consumed_fat_g numeric, macro_data_complete boolean,
  calorie_target numeric, protein_target_g numeric,
  carbohydrate_target_g numeric, fat_target_g numeric, weight_kg numeric,
  has_entries boolean, manila_time_zone text,
  server_calculated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.get_calendar_history(p_start_date, p_end_date) $$;

create or replace function private.get_day_history(p_local_date date)
returns table (
  entry_id uuid,
  source_kind text,
  meal_type text,
  consumed_at timestamptz,
  local_date date,
  time_zone text,
  original_description text,
  total_calories numeric,
  total_protein_g numeric,
  total_carbohydrates_g numeric,
  total_fat_g numeric,
  macro_data_complete boolean,
  created_at timestamptz,
  items jsonb,
  day_entry_count integer,
  is_truncated boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform private.require_history_read_action('get_day_history');
  if p_local_date is null then
    raise exception using errcode = '22023', message = 'Manila local date is required';
  end if;

  return query
  with owned_entries as (
    select entry.*, count(*) over ()::integer as total_count
    from public.food_entries as entry
    where entry.user_id = v_user_id
      and (entry.consumed_at at time zone 'Asia/Manila')::date = p_local_date
      and entry.deleted_at is null
    order by entry.consumed_at, entry.id
    limit 500
  )
  select
    entry.id,
    entry.source_kind,
    entry.meal_type,
    entry.consumed_at,
    (entry.consumed_at at time zone 'Asia/Manila')::date,
    entry.time_zone,
    entry.original_description,
    entry.total_calories,
    entry.total_protein_g,
    entry.total_carbohydrates_g,
    entry.total_fat_g,
    entry.macro_data_complete,
    entry.created_at,
    coalesce(item.items, '[]'::jsonb),
    entry.total_count,
    entry.total_count > 500
  from owned_entries as entry
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', snapshot.id,
        'ordinal', snapshot.ordinal,
        'parent_entry_item_id', snapshot.parent_entry_item_id,
        'component_role', snapshot.component_role,
        'food_name', snapshot.food_name,
        'brand_name', snapshot.brand_name,
        'restaurant_chain_name', snapshot.restaurant_chain_name,
        'restaurant_item_name', snapshot.restaurant_item_name,
        'quantity', snapshot.quantity,
        'unit', snapshot.unit,
        'serving_description', snapshot.serving_description,
        'serving_weight_g', snapshot.serving_weight_g,
        'calories', snapshot.calories,
        'protein_g', snapshot.protein_g,
        'carbohydrates_g', snapshot.carbohydrates_g,
        'fat_g', snapshot.fat_g,
        'macro_data_complete', snapshot.macro_data_complete,
        'provider', snapshot.provider,
        'provider_identifier', snapshot.provider_identifier,
        'provider_version', snapshot.provider_version,
        'provider_retrieved_at', snapshot.provider_retrieved_at,
        'attribution', snapshot.attribution,
        'market_country_code', snapshot.market_country_code,
        'is_estimated', snapshot.is_estimated,
        'confidence', snapshot.confidence,
        'uncertainty', snapshot.uncertainty
      ) order by snapshot.ordinal
    ) as items
    from public.food_entry_items as snapshot
    where snapshot.food_entry_id = entry.id
      and snapshot.user_id = v_user_id
  ) as item on true
  order by entry.consumed_at, entry.id;
end;
$$;

create or replace function public.get_day_history(p_local_date date)
returns table (
  entry_id uuid, source_kind text, meal_type text, consumed_at timestamptz,
  local_date date, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, created_at timestamptz, items jsonb,
  day_entry_count integer, is_truncated boolean
)
language sql
security invoker
set search_path = ''
as $$ select * from private.get_day_history(p_local_date) $$;

create or replace function private.get_weight_trend(
  p_start_date date,
  p_end_date date
)
returns table (
  weight_log_id uuid,
  measured_at timestamptz,
  local_date date,
  weight_kg numeric,
  previous_weight_kg numeric,
  change_from_previous_kg numeric,
  days_since_previous integer,
  point_count integer,
  is_truncated boolean,
  manila_time_zone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform private.require_history_read_action('get_weight_trend');
  perform private.validate_manila_date_range(p_start_date, p_end_date, 366);

  return query
  with owner_points as (
    select
      log.id,
      log.measured_at,
      (log.measured_at at time zone 'Asia/Manila')::date as local_date,
      log.weight_kg,
      lag(log.weight_kg) over (
        order by log.measured_at, log.id
      ) as previous_weight_kg,
      lag((log.measured_at at time zone 'Asia/Manila')::date) over (
        order by log.measured_at, log.id
      ) as previous_local_date
    from public.weight_logs as log
    where log.user_id = v_user_id
  ), ranged as (
    select point.*, count(*) over ()::integer as total_count
    from owner_points as point
    where point.local_date between p_start_date and p_end_date
    order by point.measured_at, point.id
    limit 2000
  )
  select
    point.id,
    point.measured_at,
    point.local_date,
    point.weight_kg,
    point.previous_weight_kg,
    case when point.previous_weight_kg is null then null
      else (point.weight_kg - point.previous_weight_kg)::numeric(7,2) end,
    case when point.previous_local_date is null then null
      else point.local_date - point.previous_local_date end,
    point.total_count,
    point.total_count > 2000,
    'Asia/Manila'::text
  from ranged as point
  order by point.measured_at, point.id;
end;
$$;

create or replace function public.get_weight_trend(
  p_start_date date,
  p_end_date date
)
returns table (
  weight_log_id uuid, measured_at timestamptz, local_date date,
  weight_kg numeric, previous_weight_kg numeric,
  change_from_previous_kg numeric, days_since_previous integer,
  point_count integer, is_truncated boolean, manila_time_zone text
)
language sql
security invoker
set search_path = ''
as $$ select * from private.get_weight_trend(p_start_date, p_end_date) $$;

create or replace function private.get_progress_summary(
  p_start_date date,
  p_end_date date
)
returns table (
  start_date date,
  end_date date,
  range_days integer,
  logged_days integer,
  total_entries integer,
  average_daily_calories numeric,
  complete_macro_days integer,
  average_daily_protein_g numeric,
  average_daily_carbohydrates_g numeric,
  average_daily_fat_g numeric,
  first_weight_date date,
  first_weight_kg numeric,
  latest_weight_date date,
  latest_weight_kg numeric,
  weight_change_kg numeric,
  calorie_target numeric,
  protein_target_g numeric,
  carbohydrate_target_g numeric,
  fat_target_g numeric,
  manila_time_zone text,
  server_calculated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_calculated_at timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  perform private.require_history_read_action('get_progress_summary');
  perform private.validate_manila_date_range(p_start_date, p_end_date, 366);

  return query
  with entry_days as (
    select
      (entry.consumed_at at time zone 'Asia/Manila')::date as local_date,
      count(*)::integer as entry_count,
      sum(entry.total_calories)::numeric(12,2) as calories,
      bool_and(entry.macro_data_complete) as macros_complete,
      case when bool_and(entry.macro_data_complete)
        then sum(entry.total_protein_g)::numeric(12,3) else null end as protein_g,
      case when bool_and(entry.macro_data_complete)
        then sum(entry.total_carbohydrates_g)::numeric(12,3) else null end as carbohydrates_g,
      case when bool_and(entry.macro_data_complete)
        then sum(entry.total_fat_g)::numeric(12,3) else null end as fat_g
    from public.food_entries as entry
    where entry.user_id = v_user_id
      and entry.deleted_at is null
      and (entry.consumed_at at time zone 'Asia/Manila')::date
        between p_start_date and p_end_date
    group by (entry.consumed_at at time zone 'Asia/Manila')::date
  ), entry_summary as (
    select
      count(*)::integer as logged_days,
      coalesce(sum(day.entry_count), 0)::integer as total_entries,
      avg(day.calories)::numeric(12,2) as average_daily_calories,
      count(*) filter (where day.macros_complete)::integer as complete_macro_days,
      avg(day.protein_g) filter (where day.macros_complete)::numeric(12,3)
        as average_daily_protein_g,
      avg(day.carbohydrates_g) filter (where day.macros_complete)::numeric(12,3)
        as average_daily_carbohydrates_g,
      avg(day.fat_g) filter (where day.macros_complete)::numeric(12,3)
        as average_daily_fat_g
    from entry_days as day
  ), first_weight as (
    select (log.measured_at at time zone 'Asia/Manila')::date as local_date,
      log.weight_kg
    from public.weight_logs as log
    where log.user_id = v_user_id
      and (log.measured_at at time zone 'Asia/Manila')::date
        between p_start_date and p_end_date
    order by log.measured_at, log.id
    limit 1
  ), latest_weight as (
    select (log.measured_at at time zone 'Asia/Manila')::date as local_date,
      log.weight_kg
    from public.weight_logs as log
    where log.user_id = v_user_id
      and (log.measured_at at time zone 'Asia/Manila')::date
        between p_start_date and p_end_date
    order by log.measured_at desc, log.id desc
    limit 1
  ), end_target as (
    select
      target.calorie_target,
      target.protein_target_g,
      target.carbohydrate_target_g,
      target.fat_target_g
    from public.nutrition_targets as target
    where target.user_id = v_user_id
      and target.status = 'confirmed'
      and target.effective_from <= p_end_date
      and (target.effective_to is null or target.effective_to >= p_end_date)
    order by target.effective_from desc, target.created_at desc
    limit 1
  )
  select
    p_start_date,
    p_end_date,
    p_end_date - p_start_date + 1,
    summary.logged_days,
    summary.total_entries,
    summary.average_daily_calories,
    summary.complete_macro_days,
    summary.average_daily_protein_g,
    summary.average_daily_carbohydrates_g,
    summary.average_daily_fat_g,
    first_weight.local_date,
    first_weight.weight_kg,
    latest_weight.local_date,
    latest_weight.weight_kg,
    case
      when first_weight.weight_kg is null or latest_weight.weight_kg is null then null
      else (latest_weight.weight_kg - first_weight.weight_kg)::numeric(7,2)
    end,
    end_target.calorie_target,
    end_target.protein_target_g,
    end_target.carbohydrate_target_g,
    end_target.fat_target_g,
    'Asia/Manila'::text,
    v_calculated_at
  from entry_summary as summary
  left join first_weight on true
  left join latest_weight on true
  left join end_target on true;
end;
$$;

create or replace function public.get_progress_summary(
  p_start_date date,
  p_end_date date
)
returns table (
  start_date date, end_date date, range_days integer, logged_days integer,
  total_entries integer, average_daily_calories numeric,
  complete_macro_days integer, average_daily_protein_g numeric,
  average_daily_carbohydrates_g numeric, average_daily_fat_g numeric,
  first_weight_date date, first_weight_kg numeric,
  latest_weight_date date, latest_weight_kg numeric, weight_change_kg numeric,
  calorie_target numeric, protein_target_g numeric,
  carbohydrate_target_g numeric, fat_target_g numeric,
  manila_time_zone text, server_calculated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.get_progress_summary(p_start_date, p_end_date) $$;

create or replace function private.preview_items_snapshot_json(
  p_preview_id uuid,
  p_revision_number integer
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'ordinal', item.ordinal,
        'parent_preview_item_id', item.parent_preview_item_id,
        'component_role', item.component_role,
        'food_name', item.food_name,
        'brand_name', item.brand_name,
        'restaurant_chain_name', item.restaurant_chain_name,
        'restaurant_item_name', item.restaurant_item_name,
        'quantity', item.quantity,
        'unit', item.unit,
        'serving_description', item.serving_description,
        'serving_weight_g', item.serving_weight_g,
        'calories', item.calories,
        'protein_g', item.protein_g,
        'carbohydrates_g', item.carbohydrates_g,
        'fat_g', item.fat_g,
        'macro_data_complete', item.macro_data_complete,
        'provider', item.provider,
        'provider_identifier', item.provider_identifier,
        'provider_version', item.provider_version,
        'provider_retrieved_at', item.provider_retrieved_at,
        'attribution', item.attribution,
        'market_country_code', item.market_country_code,
        'is_estimated', item.is_estimated,
        'confidence', item.confidence,
        'uncertainty', item.uncertainty
      ) order by item.ordinal
    ),
    '[]'::jsonb
  )
  from public.food_log_preview_items as item
  where item.preview_id = p_preview_id
    and item.revision_number = p_revision_number
    and item.user_id = (select auth.uid())
$$;

create or replace function private.copy_food_entry_to_preview(
  p_entry_id uuid,
  p_meal_type text,
  p_consumed_at timestamptz
)
returns table (
  preview_id uuid,
  revision_number integer,
  status text,
  last_presented_at timestamptz,
  expires_at timestamptz,
  meal_type text,
  consumed_at timestamptz,
  time_zone text,
  original_description text,
  total_calories numeric,
  total_protein_g numeric,
  total_carbohydrates_g numeric,
  total_fat_g numeric,
  macro_data_complete boolean,
  items jsonb,
  source_food_entry_id uuid,
  history_intent text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source public.food_entries%rowtype;
  v_preview_id uuid := gen_random_uuid();
  v_presented_at timestamptz := clock_timestamp();
  v_item_count integer;
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
  perform private.local_date_for_zone(p_consumed_at, 'Asia/Manila');

  select entry.* into v_source
  from public.food_entries as entry
  where entry.id = p_entry_id
    and entry.user_id = v_user_id
    and entry.deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'active entry not found';
  end if;

  insert into public.chatgpt_log_previews (
    id, user_id, source_kind, status, revision_number, expires_at,
    history_intent, source_food_entry_id
  ) values (
    v_preview_id, v_user_id, 'manual', 'draft', 1,
    v_presented_at + interval '24 hours', 'copy', v_source.id
  );

  insert into public.food_log_preview_revisions (
    preview_id, revision_number, user_id, meal_type, consumed_at, time_zone,
    original_description, total_calories, total_protein_g,
    total_carbohydrates_g, total_fat_g
  ) values (
    v_preview_id, 1, v_user_id, p_meal_type, p_consumed_at, 'Asia/Manila',
    v_source.original_description, v_source.total_calories,
    v_source.total_protein_g, v_source.total_carbohydrates_g,
    v_source.total_fat_g
  );

  with mapped as materialized (
    select snapshot.*, gen_random_uuid() as new_id
    from public.food_entry_items as snapshot
    where snapshot.food_entry_id = v_source.id
      and snapshot.user_id = v_user_id
  )
  insert into public.food_log_preview_items (
    id, preview_id, revision_number, user_id, ordinal,
    parent_preview_item_id, component_role, food_product_id,
    restaurant_chain_id, restaurant_menu_item_id, food_name, brand_name,
    restaurant_chain_name, restaurant_item_name, quantity, unit,
    serving_description, serving_weight_g, calories, protein_g,
    carbohydrates_g, fat_g, provider, provider_identifier, provider_version,
    provider_retrieved_at, attribution, market_country_code, is_estimated,
    confidence, uncertainty
  )
  select
    item.new_id, v_preview_id, 1, v_user_id, item.ordinal,
    parent.new_id, item.component_role, item.food_product_id,
    item.restaurant_chain_id, item.restaurant_menu_item_id,
    item.food_name, item.brand_name, item.restaurant_chain_name,
    item.restaurant_item_name, item.quantity, item.unit,
    item.serving_description, item.serving_weight_g, item.calories,
    item.protein_g, item.carbohydrates_g, item.fat_g, item.provider,
    item.provider_identifier, item.provider_version,
    item.provider_retrieved_at, item.attribution, item.market_country_code,
    item.is_estimated, item.confidence, item.uncertainty
  from mapped as item
  left join mapped as parent on parent.id = item.parent_entry_item_id;

  get diagnostics v_item_count = row_count;
  if v_item_count = 0 then
    raise exception using errcode = '55000', message = 'source entry has no immutable item snapshots';
  end if;

  update public.food_log_preview_revisions as revision
  set presented_at = v_presented_at,
      server_calculated_at = v_presented_at
  where revision.preview_id = v_preview_id
    and revision.revision_number = 1
    and revision.user_id = v_user_id;

  update public.chatgpt_log_previews as preview
  set status = 'ready',
      last_presented_at = v_presented_at,
      updated_at = v_presented_at
  where preview.id = v_preview_id and preview.user_id = v_user_id;

  return query
  select
    preview.id,
    preview.revision_number,
    preview.status,
    preview.last_presented_at,
    preview.expires_at,
    revision.meal_type,
    revision.consumed_at,
    revision.time_zone,
    revision.original_description,
    revision.total_calories,
    revision.total_protein_g,
    revision.total_carbohydrates_g,
    revision.total_fat_g,
    revision.macro_data_complete,
    private.preview_items_snapshot_json(
      preview.id, preview.revision_number
    ),
    preview.source_food_entry_id,
    preview.history_intent
  from public.chatgpt_log_previews as preview
  join public.food_log_preview_revisions as revision
    on revision.preview_id = preview.id
   and revision.revision_number = preview.revision_number
  where preview.id = v_preview_id and preview.user_id = v_user_id;
end;
$$;

create or replace function public.copy_food_entry_to_preview(
  p_entry_id uuid,
  p_meal_type text,
  p_consumed_at timestamptz
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, items jsonb,
  source_food_entry_id uuid, history_intent text
)
language sql
security invoker
set search_path = ''
as $$ select * from private.copy_food_entry_to_preview(
  p_entry_id, p_meal_type, p_consumed_at
) $$;

create or replace function private.create_food_entry_edit_preview(
  p_entry_id uuid,
  p_meal_type text,
  p_consumed_at timestamptz,
  p_original_description text,
  p_items jsonb
)
returns table (
  preview_id uuid,
  revision_number integer,
  status text,
  last_presented_at timestamptz,
  expires_at timestamptz,
  meal_type text,
  consumed_at timestamptz,
  time_zone text,
  original_description text,
  total_calories numeric,
  total_protein_g numeric,
  total_carbohydrates_g numeric,
  total_fat_g numeric,
  macro_data_complete boolean,
  items jsonb,
  source_food_entry_id uuid,
  history_intent text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source public.food_entries%rowtype;
  v_preview_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;

  select entry.* into v_source
  from public.food_entries as entry
  where entry.id = p_entry_id
    and entry.user_id = v_user_id
    and entry.deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'active entry not found';
  end if;

  select created.preview_id into v_preview_id
  from private.create_manual_food_log_preview(
    p_meal_type,
    p_consumed_at,
    'Asia/Manila',
    p_original_description,
    p_items
  ) as created;

  update public.chatgpt_log_previews as preview
  set history_intent = 'replace',
      source_food_entry_id = v_source.id,
      updated_at = clock_timestamp()
  where preview.id = v_preview_id and preview.user_id = v_user_id;

  return query
  select
    preview.id,
    preview.revision_number,
    preview.status,
    preview.last_presented_at,
    preview.expires_at,
    revision.meal_type,
    revision.consumed_at,
    revision.time_zone,
    revision.original_description,
    revision.total_calories,
    revision.total_protein_g,
    revision.total_carbohydrates_g,
    revision.total_fat_g,
    revision.macro_data_complete,
    private.preview_items_snapshot_json(
      preview.id, preview.revision_number
    ),
    preview.source_food_entry_id,
    preview.history_intent
  from public.chatgpt_log_previews as preview
  join public.food_log_preview_revisions as revision
    on revision.preview_id = preview.id
   and revision.revision_number = preview.revision_number
  where preview.id = v_preview_id and preview.user_id = v_user_id;
end;
$$;

create or replace function public.create_food_entry_edit_preview(
  p_entry_id uuid,
  p_meal_type text,
  p_consumed_at timestamptz,
  p_original_description text,
  p_items jsonb
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, items jsonb,
  source_food_entry_id uuid, history_intent text
)
language sql
security invoker
set search_path = ''
as $$ select * from private.create_food_entry_edit_preview(
  p_entry_id, p_meal_type, p_consumed_at, p_original_description, p_items
) $$;

create or replace function private.replace_history_source_on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.food_entries%rowtype;
begin
  if new.status = 'confirmed'
    and old.status is distinct from 'confirmed'
    and new.history_intent = 'replace' then
    select entry.* into v_source
    from public.food_entries as entry
    where entry.id = new.source_food_entry_id
      and entry.user_id = new.user_id
      and entry.deleted_at is null
    for update;

    if not found then
      raise exception using errcode = '55000',
        message = 'source entry is no longer active for replacement';
    end if;
    if new.confirmed_entry_id is null or new.confirmed_entry_id = v_source.id then
      raise exception using errcode = '55000', message = 'replacement entry lineage is invalid';
    end if;

    update public.food_entries as entry
    set deleted_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where entry.id = v_source.id and entry.user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger chatgpt_log_previews_replace_history_source
before update of status, confirmed_entry_id on public.chatgpt_log_previews
for each row execute function private.replace_history_source_on_confirmation();

-- Repeat function ACL hardening after Phase 5 and grant only reviewed bridge
-- pairs. Private validators and the replacement trigger remain uncallable.
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
grant execute on function private.lookup_barcode_candidates(text, text) to authenticated;
grant execute on function private.create_barcode_food_log_preview(uuid, uuid, uuid, numeric, text, timestamptz, text, text) to authenticated;
grant execute on function private.revise_barcode_food_log_preview(uuid, integer, uuid, numeric) to authenticated;
grant execute on function private.get_calendar_history(date, date) to authenticated;
grant execute on function private.get_day_history(date) to authenticated;
grant execute on function private.get_weight_trend(date, date) to authenticated;
grant execute on function private.get_progress_summary(date, date) to authenticated;
grant execute on function private.copy_food_entry_to_preview(uuid, text, timestamptz) to authenticated;
grant execute on function private.create_food_entry_edit_preview(uuid, text, timestamptz, text, jsonb) to authenticated;

grant execute on function public.confirm_food_log(uuid, integer, boolean, text) to authenticated;
grant execute on function public.rebuild_my_daily_summaries(date, date) to authenticated;
grant execute on function public.upsert_profile(text, date, text, numeric, text, text) to authenticated;
grant execute on function public.propose_nutrition_target(numeric, text, text, numeric, date) to authenticated;
grant execute on function public.confirm_nutrition_target(uuid, boolean) to authenticated;
grant execute on function public.create_manual_food_log_preview(text, timestamptz, text, text, jsonb) to authenticated;
grant execute on function public.save_food_for_reuse(text, text, text, numeric, text, numeric, numeric, boolean, numeric, numeric, numeric) to authenticated;
grant execute on function public.record_weight(timestamptz, text, numeric, text) to authenticated;
grant execute on function public.delete_food_entry(uuid, boolean) to authenticated;
grant execute on function public.lookup_barcode_candidates(text, text) to authenticated;
grant execute on function public.create_barcode_food_log_preview(uuid, uuid, uuid, numeric, text, timestamptz, text, text) to authenticated;
grant execute on function public.revise_barcode_food_log_preview(uuid, integer, uuid, numeric) to authenticated;
grant execute on function public.get_calendar_history(date, date) to authenticated;
grant execute on function public.get_day_history(date) to authenticated;
grant execute on function public.get_weight_trend(date, date) to authenticated;
grant execute on function public.get_progress_summary(date, date) to authenticated;
grant execute on function public.copy_food_entry_to_preview(uuid, text, timestamptz) to authenticated;
grant execute on function public.create_food_entry_edit_preview(uuid, text, timestamptz, text, jsonb) to authenticated;
