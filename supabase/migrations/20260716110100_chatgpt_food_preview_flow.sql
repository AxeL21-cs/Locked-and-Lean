-- OAuth-only ChatGPT food previews. These functions accept item-level
-- interpretation, calculate aggregate totals on the server, and never create
-- a permanent food entry. Canonical confirmation remains the only diary write.

create or replace function private.create_chatgpt_food_log_preview(
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
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
  items jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id text := (select auth.jwt()) ->> 'client_id';
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
  if v_client_id is null or not exists (
    select 1
    from private.oauth_client_action_policies as policy
    where policy.client_id = v_client_id
      and policy.action = 'preview_food_log'
      and policy.enabled
  ) then
    raise exception using errcode = '42501', message = 'oauth client is not authorized for this action';
  end if;
  if p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception using errcode = '22023', message = 'meal type is invalid';
  end if;
  if p_time_zone is distinct from 'Asia/Manila' then
    raise exception using errcode = '22023', message = 'time zone is invalid';
  end if;
  perform private.local_date_for_zone(p_consumed_at, p_time_zone);
  if p_original_description is null
    or length(btrim(p_original_description)) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'description is invalid';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'preview requires 1 to 100 items';
  end if;

  insert into public.chatgpt_log_previews (
    id, user_id, source_kind, status, revision_number, expires_at
  ) values (
    v_preview_id, v_user_id, 'chatgpt', 'draft', 1,
    v_presented_at + interval '24 hours'
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
    null,
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
    'chatgpt_interpretation_v1',
    null,
    true,
    item.confidence,
    case
      when item.uncertainty is null
        or item.uncertainty in ('[]'::jsonb, '{}'::jsonb)
      then jsonb_build_array(jsonb_build_object(
        'code', 'chatgpt_estimate',
        'message', 'Portion and nutrition values are estimates; review before confirming.'
      ))
      else item.uncertainty
    end,
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
    confidence numeric,
    uncertainty jsonb
  )
  where item.food_name is not null
    and length(btrim(item.food_name)) between 1 and 300
    and (item.brand_name is null or length(btrim(item.brand_name)) <= 300)
    and item.quantity > 0 and item.quantity <= 1000
    and item.unit is not null
    and length(btrim(item.unit)) between 1 and 80
    and (
      item.serving_description is null
      or length(btrim(item.serving_description)) <= 200
    )
    and item.calories between 0 and 100000
    and (item.protein_g is null or item.protein_g between 0 and 10000)
    and (item.carbohydrates_g is null or item.carbohydrates_g between 0 and 10000)
    and (item.fat_g is null or item.fat_g between 0 and 10000)
    and (
      item.serving_weight_g is null
      or item.serving_weight_g between 0.0001 and 100000
    )
    and (item.confidence is null or item.confidence between 0 and 1)
    and (
      item.uncertainty is null
      or jsonb_typeof(item.uncertainty) in ('array', 'object')
    );

  get diagnostics v_item_count = row_count;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception using errcode = '22023', message = 'one or more preview items are invalid';
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
  where i.preview_id = v_preview_id
    and i.revision_number = 1
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
  set status = 'ready',
      last_presented_at = v_presented_at,
      updated_at = v_presented_at
  where preview.id = v_preview_id and preview.user_id = v_user_id;

  insert into public.oauth_action_audit (
    user_id, oauth_client_id, action, outcome, preview_id
  ) values (
    v_user_id, v_client_id, 'preview_food_log', 'succeeded', v_preview_id
  );

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
    coalesce((
      select jsonb_agg(jsonb_build_object(
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
        'is_estimated', item.is_estimated,
        'confidence', item.confidence,
        'uncertainty', item.uncertainty
      ) order by item.ordinal)
      from public.food_log_preview_items as item
      where item.preview_id = preview.id
        and item.revision_number = preview.revision_number
        and item.user_id = v_user_id
    ), '[]'::jsonb)
  from public.chatgpt_log_previews as preview
  join public.food_log_preview_revisions as revision
    on revision.preview_id = preview.id
   and revision.revision_number = preview.revision_number
   and revision.user_id = preview.user_id
  where preview.id = v_preview_id and preview.user_id = v_user_id;
end;
$$;

create or replace function public.create_chatgpt_food_log_preview(
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
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
  items jsonb
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_chatgpt_food_log_preview(
    p_meal_type, p_consumed_at, p_time_zone, p_original_description, p_items
  )
$$;

create or replace function private.revise_chatgpt_food_log_preview(
  p_preview_id uuid,
  p_expected_revision integer,
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
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
  items jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id text := (select auth.jwt()) ->> 'client_id';
  v_preview public.chatgpt_log_previews%rowtype;
  v_revision_number integer;
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
  if v_client_id is null or not exists (
    select 1
    from private.oauth_client_action_policies as policy
    where policy.client_id = v_client_id
      and policy.action = 'revise_food_log_preview'
      and policy.enabled
  ) then
    raise exception using errcode = '42501', message = 'oauth client is not authorized for this action';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'expected revision is invalid';
  end if;
  if p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception using errcode = '22023', message = 'meal type is invalid';
  end if;
  if p_time_zone is distinct from 'Asia/Manila' then
    raise exception using errcode = '22023', message = 'time zone is invalid';
  end if;
  perform private.local_date_for_zone(p_consumed_at, p_time_zone);
  if p_original_description is null
    or length(btrim(p_original_description)) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'description is invalid';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'preview requires 1 to 100 items';
  end if;

  select preview.* into v_preview
  from public.chatgpt_log_previews as preview
  where preview.id = p_preview_id and preview.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'preview not found';
  end if;
  if v_preview.source_kind <> 'chatgpt' then
    raise exception using errcode = '42501', message = 'preview cannot be revised by this action';
  end if;
  if v_preview.status <> 'ready' then
    raise exception using errcode = 'P0001', message = 'preview is not revisable';
  end if;
  if v_preview.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'preview has expired';
  end if;
  if v_preview.revision_number <> p_expected_revision then
    raise exception using errcode = 'P0001', message = 'stale preview revision';
  end if;

  v_revision_number := p_expected_revision + 1;

  insert into public.food_log_preview_revisions (
    preview_id, revision_number, user_id, meal_type, consumed_at, time_zone,
    original_description, total_calories, total_protein_g,
    total_carbohydrates_g, total_fat_g
  ) values (
    v_preview.id, v_revision_number, v_user_id, p_meal_type, p_consumed_at,
    p_time_zone, btrim(p_original_description), 0, null, null, null
  );

  insert into public.food_log_preview_items (
    preview_id, revision_number, user_id, ordinal, component_role,
    food_product_id, food_name, brand_name, quantity, unit,
    serving_description, serving_weight_g, calories, protein_g,
    carbohydrates_g, fat_g, provider, provider_identifier,
    is_estimated, confidence, uncertainty, market_country_code
  )
  select
    v_preview.id,
    v_revision_number,
    v_user_id,
    element.ordinal::smallint,
    'standalone',
    null,
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
    'chatgpt_interpretation_v1',
    null,
    true,
    item.confidence,
    case
      when item.uncertainty is null
        or item.uncertainty in ('[]'::jsonb, '{}'::jsonb)
      then jsonb_build_array(jsonb_build_object(
        'code', 'chatgpt_estimate',
        'message', 'Portion and nutrition values are estimates; review before confirming.'
      ))
      else item.uncertainty
    end,
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
    confidence numeric,
    uncertainty jsonb
  )
  where item.food_name is not null
    and length(btrim(item.food_name)) between 1 and 300
    and (item.brand_name is null or length(btrim(item.brand_name)) <= 300)
    and item.quantity > 0 and item.quantity <= 1000
    and item.unit is not null
    and length(btrim(item.unit)) between 1 and 80
    and (
      item.serving_description is null
      or length(btrim(item.serving_description)) <= 200
    )
    and item.calories between 0 and 100000
    and (item.protein_g is null or item.protein_g between 0 and 10000)
    and (item.carbohydrates_g is null or item.carbohydrates_g between 0 and 10000)
    and (item.fat_g is null or item.fat_g between 0 and 10000)
    and (
      item.serving_weight_g is null
      or item.serving_weight_g between 0.0001 and 100000
    )
    and (item.confidence is null or item.confidence between 0 and 1)
    and (
      item.uncertainty is null
      or jsonb_typeof(item.uncertainty) in ('array', 'object')
    );

  get diagnostics v_item_count = row_count;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception using errcode = '22023', message = 'one or more preview items are invalid';
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
  where i.preview_id = v_preview.id
    and i.revision_number = v_revision_number
    and i.user_id = v_user_id;

  update public.food_log_preview_revisions as revision
  set total_calories = v_calories,
      total_protein_g = v_protein,
      total_carbohydrates_g = v_carbohydrates,
      total_fat_g = v_fat,
      presented_at = v_presented_at,
      server_calculated_at = v_presented_at
  where revision.preview_id = v_preview.id
    and revision.revision_number = v_revision_number
    and revision.user_id = v_user_id;

  update public.chatgpt_log_previews as preview
  set revision_number = v_revision_number,
      status = 'ready',
      last_presented_at = v_presented_at,
      updated_at = v_presented_at
  where preview.id = v_preview.id and preview.user_id = v_user_id;

  insert into public.oauth_action_audit (
    user_id, oauth_client_id, action, outcome, preview_id
  ) values (
    v_user_id, v_client_id, 'revise_food_log_preview', 'succeeded', v_preview.id
  );

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
    coalesce((
      select jsonb_agg(jsonb_build_object(
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
        'is_estimated', item.is_estimated,
        'confidence', item.confidence,
        'uncertainty', item.uncertainty
      ) order by item.ordinal)
      from public.food_log_preview_items as item
      where item.preview_id = preview.id
        and item.revision_number = preview.revision_number
        and item.user_id = v_user_id
    ), '[]'::jsonb)
  from public.chatgpt_log_previews as preview
  join public.food_log_preview_revisions as revision
    on revision.preview_id = preview.id
   and revision.revision_number = preview.revision_number
   and revision.user_id = preview.user_id
  where preview.id = v_preview.id and preview.user_id = v_user_id;
end;
$$;

create or replace function public.revise_chatgpt_food_log_preview(
  p_preview_id uuid,
  p_expected_revision integer,
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
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
  items jsonb
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.revise_chatgpt_food_log_preview(
    p_preview_id, p_expected_revision, p_meal_type, p_consumed_at,
    p_time_zone, p_original_description, p_items
  )
$$;

revoke all on function private.create_chatgpt_food_log_preview(
  text, timestamptz, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.create_chatgpt_food_log_preview(
  text, timestamptz, text, text, jsonb
) from public, anon, authenticated;
revoke all on function private.revise_chatgpt_food_log_preview(
  uuid, integer, text, timestamptz, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.revise_chatgpt_food_log_preview(
  uuid, integer, text, timestamptz, text, text, jsonb
) from public, anon, authenticated;

grant execute on function private.create_chatgpt_food_log_preview(
  text, timestamptz, text, text, jsonb
) to authenticated;
grant execute on function public.create_chatgpt_food_log_preview(
  text, timestamptz, text, text, jsonb
) to authenticated;
grant execute on function private.revise_chatgpt_food_log_preview(
  uuid, integer, text, timestamptz, text, text, jsonb
) to authenticated;
grant execute on function public.revise_chatgpt_food_log_preview(
  uuid, integer, text, timestamptz, text, text, jsonb
) to authenticated;
