-- Fast logging and resilient offline synchronization.
-- Historical portions are immutable snapshots with explicit provenance. They
-- are suggestions only and must always become a presented preview before an
-- exact revision can be confirmed.

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  default_meal_type text not null check (
    default_meal_type in ('breakfast', 'lunch', 'dinner', 'snack')
  ),
  is_favorite boolean not null default false,
  source_food_entry_id uuid,
  source_local_date date not null,
  source_consumed_at timestamptz not null,
  source_description text not null,
  items jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100
  ),
  item_count smallint not null check (item_count between 1 and 100),
  total_calories numeric(10,2) not null check (total_calories between 0 and 100000),
  total_protein_g numeric(10,3),
  total_carbohydrates_g numeric(10,3),
  total_fat_g numeric(10,3),
  client_operation_id uuid not null,
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_operation_id),
  constraint saved_meals_source_owner_fkey
    foreign key (source_food_entry_id, user_id)
    references public.food_entries (id, user_id)
    on delete set null (source_food_entry_id)
);

create index saved_meals_user_favorite_updated_idx
  on public.saved_meals (user_id, is_favorite desc, updated_at desc);

alter table public.saved_meals enable row level security;

create policy saved_meals_select_own on public.saved_meals
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.saved_meals from anon, authenticated;
grant select on table public.saved_meals to authenticated;

create or replace function private.food_entry_items_for_reuse(
  p_entry_id uuid,
  p_reuse_kind text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'food_name', item.food_name,
      'brand_name', item.brand_name,
      'quantity', item.quantity,
      'unit', item.unit,
      'serving_description', item.serving_description,
      'serving_weight_g', item.serving_weight_g,
      'calories', item.calories,
      'protein_g', item.protein_g,
      'carbohydrates_g', item.carbohydrates_g,
      'fat_g', item.fat_g,
      'food_product_id', item.food_product_id,
      'is_estimated', item.is_estimated,
      'confidence', item.confidence,
      'uncertainty',
        case when jsonb_typeof(item.uncertainty) = 'array'
          then item.uncertainty
          else jsonb_build_array(item.uncertainty)
        end || jsonb_build_array(jsonb_build_object(
          'code', 'historical_portion_reuse',
          'message', 'Copied from a previously confirmed portion; review the amount before confirming.',
          'reuse_kind', p_reuse_kind,
          'source_entry_id', entry.id,
          'source_consumed_at', entry.consumed_at
        ))
    ) order by item.ordinal
  ), '[]'::jsonb)
  from public.food_entries as entry
  join public.food_entry_items as item
    on item.food_entry_id = entry.id and item.user_id = entry.user_id
  where entry.id = p_entry_id
    and entry.user_id = (select auth.uid())
    and item.component_role <> 'meal'
$$;

create or replace function private.save_food_entry_as_saved_meal(
  p_entry_id uuid,
  p_name text,
  p_is_favorite boolean,
  p_client_operation_id uuid
)
returns table (
  saved_meal_id uuid, name text, default_meal_type text,
  is_favorite boolean, item_count integer, reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry public.food_entries%rowtype;
  v_items jsonb;
  v_saved public.saved_meals%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  if p_client_operation_id is null then
    raise exception using errcode = '22023', message = 'client operation id is required';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'saved meal name is invalid';
  end if;

  select entry.* into v_entry
  from public.food_entries as entry
  where entry.id = p_entry_id and entry.user_id = v_user_id
    and entry.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'active entry not found';
  end if;

  select * into v_saved
  from public.saved_meals as meal
  where meal.user_id = v_user_id
    and meal.client_operation_id = p_client_operation_id
  for update;
  if found then
    if v_saved.source_food_entry_id is distinct from p_entry_id
      or v_saved.name is distinct from btrim(p_name)
      or v_saved.is_favorite is distinct from coalesce(p_is_favorite, false) then
      raise exception using errcode = '22023', message = 'client operation id was reused with different saved meal input';
    end if;
    return query select v_saved.id, v_saved.name, v_saved.default_meal_type,
      v_saved.is_favorite, v_saved.item_count::integer, true;
    return;
  end if;

  v_items := private.food_entry_items_for_reuse(v_entry.id, 'saved_meal');
  if jsonb_array_length(v_items) = 0 then
    raise exception using errcode = '55000', message = 'source entry has no reusable item snapshots';
  end if;

  insert into public.saved_meals (
    user_id, name, default_meal_type, is_favorite,
    source_food_entry_id, source_local_date, source_consumed_at,
    source_description, items, item_count, total_calories,
    total_protein_g, total_carbohydrates_g, total_fat_g,
    client_operation_id
  ) values (
    v_user_id, btrim(p_name), v_entry.meal_type, coalesce(p_is_favorite, false),
    v_entry.id, v_entry.local_date, v_entry.consumed_at,
    v_entry.original_description, v_items, jsonb_array_length(v_items),
    v_entry.total_calories, v_entry.total_protein_g,
    v_entry.total_carbohydrates_g, v_entry.total_fat_g,
    p_client_operation_id
  ) returning * into v_saved;

  return query select v_saved.id, v_saved.name, v_saved.default_meal_type,
    v_saved.is_favorite, v_saved.item_count::integer, false;
end;
$$;

create or replace function public.save_food_entry_as_saved_meal(
  p_entry_id uuid, p_name text, p_is_favorite boolean,
  p_client_operation_id uuid
)
returns table (
  saved_meal_id uuid, name text, default_meal_type text,
  is_favorite boolean, item_count integer, reused boolean
)
language sql security invoker set search_path = ''
as $$ select * from private.save_food_entry_as_saved_meal(
  p_entry_id, p_name, p_is_favorite, p_client_operation_id
) $$;

create or replace function private.set_saved_meal_favorite(
  p_saved_meal_id uuid, p_is_favorite boolean
)
returns table (saved_meal_id uuid, is_favorite boolean)
language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  return query
  update public.saved_meals as meal
  set is_favorite = coalesce(p_is_favorite, false), updated_at = now()
  where meal.id = p_saved_meal_id and meal.user_id = v_user_id
  returning meal.id, meal.is_favorite;
  if not found then
    raise exception using errcode = '42501', message = 'saved meal not found';
  end if;
end;
$$;

create or replace function public.set_saved_meal_favorite(
  p_saved_meal_id uuid, p_is_favorite boolean
)
returns table (saved_meal_id uuid, is_favorite boolean)
language sql security invoker set search_path = ''
as $$ select * from private.set_saved_meal_favorite(p_saved_meal_id, p_is_favorite) $$;

create or replace function private.create_saved_meal_preview(
  p_saved_meal_id uuid, p_meal_type text, p_consumed_at timestamptz
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_meal public.saved_meals%rowtype;
  v_preview_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  select meal.* into v_meal from public.saved_meals as meal
  where meal.id = p_saved_meal_id and meal.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'saved meal not found';
  end if;

  select created.preview_id into v_preview_id
  from private.create_manual_food_log_preview(
    coalesce(p_meal_type, v_meal.default_meal_type), p_consumed_at,
    'Asia/Manila', 'Saved meal: ' || v_meal.name, v_meal.items
  ) as created;

  update public.chatgpt_log_previews
  set source_kind = 'saved_food', updated_at = now()
  where id = v_preview_id and user_id = v_user_id;
  update public.food_log_preview_items as preview_item
  set provider = 'saved_meal_snapshot_v1',
      provider_identifier = v_meal.id::text
  where preview_item.preview_id = v_preview_id
    and preview_item.user_id = v_user_id;
  update public.saved_meals
  set use_count = use_count + 1, last_used_at = now(), updated_at = now()
  where id = v_meal.id and user_id = v_user_id;

  return query
  select p.id, p.revision_number, p.status, p.last_presented_at, p.expires_at,
    r.meal_type, r.consumed_at, r.time_zone, r.original_description,
    r.total_calories, r.total_protein_g, r.total_carbohydrates_g,
    r.total_fat_g, r.macro_data_complete
  from public.chatgpt_log_previews p
  join public.food_log_preview_revisions r
    on r.preview_id = p.id and r.revision_number = p.revision_number
  where p.id = v_preview_id and p.user_id = v_user_id;
end;
$$;

create or replace function public.create_saved_meal_preview(
  p_saved_meal_id uuid, p_meal_type text, p_consumed_at timestamptz
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean
)
language sql security invoker set search_path = ''
as $$ select * from private.create_saved_meal_preview(
  p_saved_meal_id, p_meal_type, p_consumed_at
) $$;

create or replace function private.create_repeat_meal_preview(
  p_meal_type text, p_consumed_at timestamptz, p_source_date date default null
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, source_local_date date
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source_date date;
  v_items jsonb;
  v_preview_id uuid;
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

  select coalesce(p_source_date, max(entry.local_date)) into v_source_date
  from public.food_entries entry
  where entry.user_id = v_user_id and entry.deleted_at is null
    and entry.meal_type = p_meal_type
    and entry.local_date < private.local_date_for_zone(p_consumed_at, 'Asia/Manila')
    and (p_source_date is null or entry.local_date = p_source_date);
  if v_source_date is null then
    raise exception using errcode = 'P0001', message = 'no prior meal found';
  end if;

  select jsonb_agg(jsonb_build_object(
    'food_name', item.food_name, 'brand_name', item.brand_name,
    'quantity', item.quantity, 'unit', item.unit,
    'serving_description', item.serving_description,
    'serving_weight_g', item.serving_weight_g, 'calories', item.calories,
    'protein_g', item.protein_g, 'carbohydrates_g', item.carbohydrates_g,
    'fat_g', item.fat_g, 'food_product_id', item.food_product_id,
    'is_estimated', item.is_estimated, 'confidence', item.confidence,
    'uncertainty', (case when jsonb_typeof(item.uncertainty) = 'array'
      then item.uncertainty else jsonb_build_array(item.uncertainty) end)
      || jsonb_build_array(jsonb_build_object(
        'code', 'historical_portion_reuse',
        'message', 'Based on your confirmed ' || p_meal_type ||
          ' from ' || v_source_date::text || '; review today''s portion.',
        'source_entry_id', entry.id,
        'source_consumed_at', entry.consumed_at
      ))
  ) order by entry.consumed_at, item.ordinal) into v_items
  from public.food_entries entry
  join public.food_entry_items item
    on item.food_entry_id = entry.id and item.user_id = entry.user_id
  where entry.user_id = v_user_id and entry.deleted_at is null
    and entry.meal_type = p_meal_type and entry.local_date = v_source_date
    and item.component_role <> 'meal';
  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception using errcode = '55000', message = 'prior meal has no reusable item snapshots';
  end if;

  select created.preview_id into v_preview_id
  from private.create_manual_food_log_preview(
    p_meal_type, p_consumed_at, 'Asia/Manila',
    'Repeat ' || p_meal_type || ' from ' || v_source_date::text, v_items
  ) created;
  update public.food_log_preview_items as preview_item
  set provider = 'confirmed_history_context_v1'
  where preview_item.preview_id = v_preview_id
    and preview_item.user_id = v_user_id;

  return query
  select p.id, p.revision_number, p.status, p.last_presented_at, p.expires_at,
    r.meal_type, r.consumed_at, r.time_zone, r.original_description,
    r.total_calories, r.total_protein_g, r.total_carbohydrates_g,
    r.total_fat_g, r.macro_data_complete, v_source_date
  from public.chatgpt_log_previews p
  join public.food_log_preview_revisions r
    on r.preview_id = p.id and r.revision_number = p.revision_number
  where p.id = v_preview_id and p.user_id = v_user_id;
end;
$$;

create or replace function public.create_repeat_meal_preview(
  p_meal_type text, p_consumed_at timestamptz, p_source_date date default null
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, source_local_date date
)
language sql security invoker set search_path = ''
as $$ select * from private.create_repeat_meal_preview(
  p_meal_type, p_consumed_at, p_source_date
) $$;

create or replace function public.get_quick_log_suggestions(p_limit integer default 20)
returns table (
  food_name text, brand_name text, quantity numeric, unit text,
  serving_description text, serving_weight_g numeric, calories numeric,
  protein_g numeric, carbohydrates_g numeric, fat_g numeric,
  last_meal_type text, last_consumed_at timestamptz,
  source_entry_id uuid, times_logged bigint, provenance jsonb
)
language sql stable security invoker set search_path = ''
as $$
  with ranked as (
    select item.*, entry.meal_type, entry.consumed_at, entry.id as entry_id,
      count(*) over (partition by lower(btrim(item.food_name)), coalesce(lower(btrim(item.brand_name)), '')) as frequency,
      row_number() over (
        partition by lower(btrim(item.food_name)), coalesce(lower(btrim(item.brand_name)), '')
        order by entry.consumed_at desc, item.ordinal
      ) as recency_rank
    from public.food_entries entry
    join public.food_entry_items item
      on item.food_entry_id = entry.id and item.user_id = entry.user_id
    where entry.user_id = (select auth.uid()) and entry.deleted_at is null
      and item.component_role <> 'meal'
      and entry.consumed_at >= now() - interval '90 days'
  )
  select food_name, brand_name, quantity, unit, serving_description,
    serving_weight_g, calories, protein_g, carbohydrates_g, fat_g,
    meal_type, consumed_at, entry_id, frequency,
    jsonb_build_object(
      'kind', 'confirmed_history',
      'source_entry_id', entry_id,
      'source_consumed_at', consumed_at,
      'message', 'Last confirmed portion; review amount and weight before confirming.'
    )
  from ranked where recency_rank = 1
  order by frequency desc, consumed_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
$$;

-- Default-deny each new function without disturbing earlier reviewed RPCs.
revoke execute on function private.food_entry_items_for_reuse(uuid,text) from public, anon, authenticated;
revoke execute on function private.save_food_entry_as_saved_meal(uuid,text,boolean,uuid) from public, anon, authenticated;
revoke execute on function private.set_saved_meal_favorite(uuid,boolean) from public, anon, authenticated;
revoke execute on function private.create_saved_meal_preview(uuid,text,timestamptz) from public, anon, authenticated;
revoke execute on function private.create_repeat_meal_preview(text,timestamptz,date) from public, anon, authenticated;
revoke execute on function public.save_food_entry_as_saved_meal(uuid,text,boolean,uuid) from public, anon, authenticated;
revoke execute on function public.set_saved_meal_favorite(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.create_saved_meal_preview(uuid,text,timestamptz) from public, anon, authenticated;
revoke execute on function public.create_repeat_meal_preview(text,timestamptz,date) from public, anon, authenticated;
revoke execute on function public.get_quick_log_suggestions(integer) from public, anon, authenticated;
grant usage on schema private to authenticated;

grant execute on function private.save_food_entry_as_saved_meal(uuid,text,boolean,uuid) to authenticated;
grant execute on function private.set_saved_meal_favorite(uuid,boolean) to authenticated;
grant execute on function private.create_saved_meal_preview(uuid,text,timestamptz) to authenticated;
grant execute on function private.create_repeat_meal_preview(text,timestamptz,date) to authenticated;

grant execute on function public.save_food_entry_as_saved_meal(uuid,text,boolean,uuid) to authenticated;
grant execute on function public.set_saved_meal_favorite(uuid,boolean) to authenticated;
grant execute on function public.create_saved_meal_preview(uuid,text,timestamptz) to authenticated;
grant execute on function public.create_repeat_meal_preview(text,timestamptz,date) to authenticated;
grant execute on function public.get_quick_log_suggestions(integer) to authenticated;
