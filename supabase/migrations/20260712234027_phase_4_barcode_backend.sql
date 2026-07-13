-- Locked and Lean Phase 4 barcode and Philippine product backend.
-- Provider observations remain server-owned catalog data. No live provider is
-- claimed by this migration, and no client-supplied nutrition total is trusted.

create table private.nutrition_provider_registry (
  provider_code text primary key check (
    provider_code ~ '^[a-z0-9][a-z0-9_.-]{1,79}$'
  ),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  integration_status text not null check (
    integration_status in ('fixture', 'configured', 'disabled')
  ),
  is_live boolean not null default false,
  supports_ph_market boolean not null default false,
  lookup_priority smallint not null default 0 check (lookup_priority between 0 and 1000),
  terms_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_provider_registry_live_check check (
    not is_live
    or (integration_status = 'configured' and terms_reviewed_at is not null)
  )
);

alter table private.nutrition_provider_registry enable row level security;
revoke all on table private.nutrition_provider_registry from public, anon, authenticated;
grant select, insert, update, delete on table private.nutrition_provider_registry to service_role;

insert into private.nutrition_provider_registry (
  provider_code,
  display_name,
  integration_status,
  is_live,
  supports_ph_market,
  lookup_priority
) values (
  'server_catalog_fixture_v1',
  'Locked and Lean development catalog fixture',
  'fixture',
  false,
  true,
  0
)
on conflict (provider_code) do nothing;

create table public.food_product_servings (
  id uuid primary key default gen_random_uuid(),
  food_product_id uuid not null references public.food_products (id) on delete cascade,
  serving_description text not null check (
    length(btrim(serving_description)) between 1 and 200
  ),
  serving_quantity numeric(12,4) not null check (serving_quantity > 0),
  serving_unit text not null check (length(btrim(serving_unit)) between 1 and 80),
  serving_weight_g numeric(12,4) check (serving_weight_g is null or serving_weight_g > 0),
  calories numeric(10,2) not null check (calories between 0 and 100000),
  protein_g numeric(10,3) check (protein_g is null or protein_g between 0 and 10000),
  carbohydrates_g numeric(10,3) check (
    carbohydrates_g is null or carbohydrates_g between 0 and 10000
  ),
  fat_g numeric(10,3) check (fat_g is null or fat_g between 0 and 10000),
  macro_data_complete boolean generated always as (
    protein_g is not null and carbohydrates_g is not null and fat_g is not null
  ) stored,
  market_country_code text check (
    market_country_code is null or market_country_code ~ '^[A-Z]{2}$'
  ),
  provider text not null check (length(btrim(provider)) between 1 and 80),
  provider_identifier text,
  provider_version text,
  provider_retrieved_at timestamptz,
  attribution text,
  is_default boolean not null default false,
  is_estimated boolean not null default false,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  uncertainty jsonb not null default '[]'::jsonb check (
    jsonb_typeof(uncertainty) in ('array', 'object')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (food_product_id, id)
);

create index food_product_servings_product_id_idx
  on public.food_product_servings (food_product_id);
create unique index food_product_servings_one_default_idx
  on public.food_product_servings (food_product_id)
  where is_default;

alter table public.food_product_servings enable row level security;

create policy food_product_servings_select_catalog_or_own
on public.food_product_servings for select to authenticated
using (
  exists (
    select 1
    from public.food_products as product
    where product.id = food_product_id
      and (product.user_id is null or product.user_id = (select auth.uid()))
  )
);

revoke all on table public.food_product_servings from anon, authenticated;
grant select on table public.food_product_servings to authenticated;
grant select, insert, update, delete on table public.food_product_servings to service_role;

alter table public.chatgpt_log_previews
  add column source_scan_session_id uuid
  references public.scan_sessions (id) on delete set null;
create index chatgpt_log_previews_source_scan_session_idx
  on public.chatgpt_log_previews (source_scan_session_id)
  where source_scan_session_id is not null;

-- GTIN-8, UPC-A, EAN-13, and GTIN-14 are compared in their equivalent
-- zero-padded GTIN-14 representation. The expression index keeps catalog
-- lookup from becoming a sequential scan as provider observations grow.
create index food_products_gtin14_idx
  on public.food_products (lpad(barcode, 14, '0'))
  where barcode is not null;

create or replace function private.normalize_gtin(p_barcode text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  with stripped as (
    select regexp_replace(
      btrim(coalesce(p_barcode, '')), '[[:space:]-]', '', 'g'
    ) as barcode
  )
  select case
    when barcode ~ '^[0-9]+$' and length(barcode) in (8, 12, 13, 14)
      then lpad(barcode, 14, '0')
    else barcode
  end
  from stripped
$$;

create or replace function private.is_valid_gtin(p_barcode text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  with normalized as (
    select private.normalize_gtin(p_barcode) as barcode
  ), digits as (
    select
      barcode,
      length(barcode) as barcode_length,
      right(barcode, 1)::integer as supplied_check_digit
    from normalized
    where barcode ~ '^[0-9]+$'
      and length(barcode) = 14
      and barcode !~ '^0+$'
  ), calculated as (
    select
      digits.*,
      (
        10 - (
          sum(
            substring(digits.barcode from position for 1)::integer
            * case when mod(digits.barcode_length - position, 2) = 1 then 3 else 1 end
          ) % 10
        )
      ) % 10 as expected_check_digit
    from digits
    cross join lateral generate_series(1, digits.barcode_length - 1) as position
    group by digits.barcode, digits.barcode_length, digits.supplied_check_digit
  )
  select coalesce(bool_and(supplied_check_digit = expected_check_digit), false)
  from calculated
$$;

create or replace function private.barcode_market_status(p_market_country_code text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_market_country_code = 'PH' then 'PH'
    when p_market_country_code is null then 'unknown'
    else 'foreign'
  end
$$;

create or replace function private.barcode_market_warning(p_market_country_code text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case private.barcode_market_status(p_market_country_code)
    when 'foreign' then 'Philippine formulation or serving size may differ.'
    when 'unknown' then 'Philippine-market formulation is unverified.'
    else null
  end
$$;

create or replace function private.barcode_source_warning(
  p_integration_status text,
  p_is_live boolean,
  p_provider_retrieved_at timestamptz
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_integration_status = 'fixture'
      then 'Development fixture data; not a live provider integration. Verify the package label.'
    when p_integration_status is null
      or p_integration_status = 'disabled'
      or not coalesce(p_is_live, false)
      then 'Live provider lookup is not connected; verify the package label.'
    when p_provider_retrieved_at is null
      then 'Provider retrieval time is unknown; verify the package label.'
    when p_provider_retrieved_at < now() - interval '365 days'
      then 'Provider observation may be stale; verify the package label.'
    else null
  end
$$;

create or replace function private.lookup_barcode_candidates(
  p_barcode text,
  p_market_country_code text
)
returns table (
  scan_session_id uuid,
  lookup_status text,
  canonical_barcode text,
  lookup_mode text,
  manual_entry_required boolean,
  candidate_rank integer,
  food_product_id uuid,
  serving_id uuid,
  canonical_name text,
  brand_name text,
  market_country_code text,
  market_status text,
  market_warning text,
  source_warning text,
  serving_description text,
  serving_quantity numeric,
  serving_unit text,
  serving_weight_g numeric,
  calories numeric,
  protein_g numeric,
  carbohydrates_g numeric,
  fat_g numeric,
  macro_data_complete boolean,
  provider text,
  provider_identifier text,
  provider_version text,
  provider_retrieved_at timestamptz,
  attribution text,
  is_estimated boolean,
  confidence numeric,
  uncertainty jsonb,
  provider_integration_status text,
  provider_terms_reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_barcode text := private.normalize_gtin(p_barcode);
  v_scan_session_id uuid := gen_random_uuid();
  v_candidate_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  if p_market_country_code <> 'PH' then
    raise exception using errcode = '22023', message = 'barcode lookup market must be PH';
  end if;
  if not private.is_valid_gtin(v_barcode) then
    raise exception using errcode = '22023', message = 'barcode must be a valid GTIN-8, UPC-A, EAN-13, or GTIN-14';
  end if;

  insert into public.scan_sessions (id, user_id, status, barcode, expires_at)
  values (v_scan_session_id, v_user_id, 'processed', v_barcode, now() + interval '30 minutes');

  select count(*)::integer
  into v_candidate_count
  from public.food_products as product
  where lpad(product.barcode, 14, '0') = v_barcode
    and (product.user_id is null or product.user_id = v_user_id);

  if v_candidate_count = 0 then
    return query select
      v_scan_session_id,
      'unknown'::text,
      v_barcode,
      'server_catalog_snapshot'::text,
      true,
      null::integer,
      null::uuid,
      null::uuid,
      null::text,
      null::text,
      null::text,
      'unknown'::text,
      'No Philippine-market product match was found.'::text,
      'Live provider lookup is not connected; enter the nutrition label manually.'::text,
      null::text,
      null::numeric,
      null::text,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::boolean,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::text,
      null::boolean,
      null::numeric,
      '[]'::jsonb,
      null::text,
      null::timestamptz;
    return;
  end if;

  return query
  with candidate_options as (
    select
      product.id as product_id,
      serving.id as option_id,
      product.canonical_name,
      product.brand_name,
      coalesce(serving.market_country_code, product.market_country_code) as option_market,
      serving.serving_description,
      serving.serving_quantity,
      serving.serving_unit,
      serving.serving_weight_g,
      serving.calories,
      serving.protein_g,
      serving.carbohydrates_g,
      serving.fat_g,
      serving.macro_data_complete,
      serving.provider,
      serving.provider_identifier,
      serving.provider_version,
      serving.provider_retrieved_at,
      serving.attribution,
      serving.is_estimated,
      serving.confidence,
      serving.uncertainty,
      serving.is_default,
      product.user_id
    from public.food_products as product
    join public.food_product_servings as serving
      on serving.food_product_id = product.id
    where lpad(product.barcode, 14, '0') = v_barcode
      and (product.user_id is null or product.user_id = v_user_id)

    union all

    select
      product.id,
      null::uuid,
      product.canonical_name,
      product.brand_name,
      product.market_country_code,
      coalesce(nullif(btrim(product.serving_quantity::text || ' ' || product.serving_unit), ''), '1 serving'),
      product.serving_quantity,
      product.serving_unit,
      product.serving_weight_g,
      product.calories,
      product.protein_g,
      product.carbohydrates_g,
      product.fat_g,
      product.macro_data_complete,
      product.provider,
      product.provider_identifier,
      product.provider_version,
      product.provider_retrieved_at,
      product.attribution,
      product.is_estimated,
      product.confidence,
      product.uncertainty,
      true,
      product.user_id
    from public.food_products as product
    where lpad(product.barcode, 14, '0') = v_barcode
      and (product.user_id is null or product.user_id = v_user_id)
      and not exists (
        select 1 from public.food_product_servings as serving
        where serving.food_product_id = product.id
      )
  ), ranked as (
    select
      option.*,
      registry.integration_status,
      registry.is_live,
      registry.terms_reviewed_at,
      row_number() over (
        order by
          case when option.user_id = v_user_id then 1 else 0 end desc,
          case private.barcode_market_status(option.option_market)
            when 'PH' then 300 when 'unknown' then 200 else 100 end desc,
          coalesce(registry.lookup_priority, 0) desc,
          option.is_default desc,
          option.canonical_name,
          option.option_id nulls last
      )::integer as option_rank
    from candidate_options as option
    left join private.nutrition_provider_registry as registry
      on registry.provider_code = option.provider
  )
  select
    v_scan_session_id,
    'found'::text,
    v_barcode,
    'server_catalog_snapshot'::text,
    false,
    ranked.option_rank,
    ranked.product_id,
    ranked.option_id,
    ranked.canonical_name,
    ranked.brand_name,
    ranked.option_market,
    private.barcode_market_status(ranked.option_market),
    private.barcode_market_warning(ranked.option_market),
    private.barcode_source_warning(
      ranked.integration_status, ranked.is_live, ranked.provider_retrieved_at
    ),
    ranked.serving_description,
    ranked.serving_quantity,
    ranked.serving_unit,
    ranked.serving_weight_g,
    ranked.calories,
    ranked.protein_g,
    ranked.carbohydrates_g,
    ranked.fat_g,
    ranked.macro_data_complete,
    ranked.provider,
    ranked.provider_identifier,
    ranked.provider_version,
    ranked.provider_retrieved_at,
    ranked.attribution,
    ranked.is_estimated,
    ranked.confidence,
    ranked.uncertainty,
    ranked.integration_status,
    ranked.terms_reviewed_at
  from ranked
  order by ranked.option_rank;
end;
$$;

create or replace function public.lookup_barcode_candidates(
  p_barcode text,
  p_market_country_code text
)
returns table (
  scan_session_id uuid, lookup_status text, canonical_barcode text,
  lookup_mode text, manual_entry_required boolean, candidate_rank integer,
  food_product_id uuid, serving_id uuid, canonical_name text, brand_name text,
  market_country_code text, market_status text, market_warning text,
  source_warning text, serving_description text, serving_quantity numeric,
  serving_unit text, serving_weight_g numeric, calories numeric, protein_g numeric,
  carbohydrates_g numeric, fat_g numeric, macro_data_complete boolean,
  provider text, provider_identifier text, provider_version text,
  provider_retrieved_at timestamptz, attribution text, is_estimated boolean,
  confidence numeric, uncertainty jsonb, provider_integration_status text,
  provider_terms_reviewed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.lookup_barcode_candidates(p_barcode, p_market_country_code) $$;

create or replace function private.selected_barcode_serving(
  p_user_id uuid,
  p_food_product_id uuid,
  p_serving_id uuid
)
returns table (
  food_product_id uuid, barcode text, canonical_name text, brand_name text,
  market_country_code text, market_status text, market_warning text,
  source_warning text, serving_id uuid, serving_description text,
  serving_quantity numeric, serving_unit text, serving_weight_g numeric,
  calories numeric, protein_g numeric, carbohydrates_g numeric, fat_g numeric,
  provider text, provider_identifier text, provider_version text,
  provider_retrieved_at timestamptz, attribution text, is_estimated boolean,
  confidence numeric, uncertainty jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    product.id,
    private.normalize_gtin(product.barcode),
    product.canonical_name,
    product.brand_name,
    coalesce(serving.market_country_code, product.market_country_code),
    private.barcode_market_status(coalesce(serving.market_country_code, product.market_country_code)),
    private.barcode_market_warning(coalesce(serving.market_country_code, product.market_country_code)),
    private.barcode_source_warning(
      registry.integration_status,
      registry.is_live,
      coalesce(serving.provider_retrieved_at, product.provider_retrieved_at)
    ),
    serving.id,
    coalesce(
      serving.serving_description,
      product.serving_quantity::text || ' ' || product.serving_unit
    ),
    coalesce(serving.serving_quantity, product.serving_quantity),
    coalesce(serving.serving_unit, product.serving_unit),
    coalesce(serving.serving_weight_g, product.serving_weight_g),
    coalesce(serving.calories, product.calories),
    case when serving.id is null then product.protein_g else serving.protein_g end,
    case when serving.id is null then product.carbohydrates_g else serving.carbohydrates_g end,
    case when serving.id is null then product.fat_g else serving.fat_g end,
    coalesce(serving.provider, product.provider),
    coalesce(serving.provider_identifier, product.provider_identifier),
    coalesce(serving.provider_version, product.provider_version),
    coalesce(serving.provider_retrieved_at, product.provider_retrieved_at),
    coalesce(serving.attribution, product.attribution),
    case when serving.id is null then product.is_estimated else serving.is_estimated end,
    case when serving.id is null then product.confidence else serving.confidence end,
    case when serving.id is null then product.uncertainty else serving.uncertainty end
  from public.food_products as product
  left join public.food_product_servings as serving
    on serving.food_product_id = product.id
   and serving.id = p_serving_id
  left join private.nutrition_provider_registry as registry
    on registry.provider_code = coalesce(serving.provider, product.provider)
  where product.id = p_food_product_id
    and product.barcode is not null
    and (product.user_id is null or product.user_id = p_user_id)
    and (
      (p_serving_id is null and not exists (
        select 1 from public.food_product_servings as option
        where option.food_product_id = product.id
      ))
      or serving.id is not null
    )
$$;

create or replace function private.barcode_preview_uncertainty(
  p_uncertainty jsonb,
  p_market_warning text,
  p_source_warning text
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    case jsonb_typeof(coalesce(p_uncertainty, '[]'::jsonb))
      when 'array' then coalesce(p_uncertainty, '[]'::jsonb)
      else jsonb_build_array(p_uncertainty)
    end
    || case when p_market_warning is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object(
        'category', 'market_variant', 'message', p_market_warning, 'source', 'domain'
      )
    ) end
    || case when p_source_warning is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object(
        'category', 'nutrition_source', 'message', p_source_warning, 'source', 'domain'
      )
    ) end
$$;

create or replace function private.create_barcode_food_log_preview(
  p_scan_session_id uuid,
  p_food_product_id uuid,
  p_serving_id uuid,
  p_serving_count numeric,
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
  p_original_description text
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, food_product_id uuid, serving_id uuid,
  food_name text, brand_name text, barcode text, serving_count numeric,
  serving_description text, serving_unit text, serving_weight_g numeric,
  provider text, provider_identifier text, provider_version text,
  provider_retrieved_at timestamptz, attribution text,
  market_country_code text, market_status text, market_warning text,
  source_warning text, is_estimated boolean, confidence numeric, uncertainty jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_presented_at timestamptz := clock_timestamp();
  v_preview_id uuid := gen_random_uuid();
  v_scan public.scan_sessions%rowtype;
  v_food record;
  v_uncertainty jsonb;
  v_total_calories numeric(10,2);
  v_total_protein numeric(10,3);
  v_total_carbohydrates numeric(10,3);
  v_total_fat numeric(10,3);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  if p_serving_count is null or p_serving_count <= 0 or p_serving_count > 100 then
    raise exception using errcode = '22023', message = 'serving count must be greater than 0 and no more than 100';
  end if;
  if p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception using errcode = '22023', message = 'meal type is invalid';
  end if;
  perform private.local_date_for_zone(p_consumed_at, p_time_zone);
  if p_original_description is null
    or length(btrim(p_original_description)) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'description is invalid';
  end if;

  select * into v_scan
  from public.scan_sessions as scan
  where scan.id = p_scan_session_id and scan.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'barcode scan session not found for current user';
  end if;
  if v_scan.expires_at <= now() or v_scan.status <> 'processed' or v_scan.barcode is null then
    raise exception using errcode = '55000', message = 'barcode scan session is not current';
  end if;

  select * into v_food
  from private.selected_barcode_serving(v_user_id, p_food_product_id, p_serving_id);
  if not found or v_food.barcode <> v_scan.barcode then
    raise exception using errcode = '22023', message = 'selected product or serving does not match this scan';
  end if;

  v_total_calories := (v_food.calories * p_serving_count)::numeric(10,2);
  v_total_protein := case when v_food.protein_g is null then null
    else (v_food.protein_g * p_serving_count)::numeric(10,3) end;
  v_total_carbohydrates := case when v_food.carbohydrates_g is null then null
    else (v_food.carbohydrates_g * p_serving_count)::numeric(10,3) end;
  v_total_fat := case when v_food.fat_g is null then null
    else (v_food.fat_g * p_serving_count)::numeric(10,3) end;
  v_uncertainty := private.barcode_preview_uncertainty(
    v_food.uncertainty, v_food.market_warning, v_food.source_warning
  );

  insert into public.chatgpt_log_previews (
    id, user_id, source_kind, status, revision_number, last_presented_at,
    expires_at, source_scan_session_id
  ) values (
    v_preview_id, v_user_id, 'barcode', 'ready', 1, v_presented_at,
    v_presented_at + interval '24 hours', p_scan_session_id
  );

  insert into public.food_log_preview_revisions (
    preview_id, revision_number, user_id, meal_type, consumed_at, time_zone,
    original_description, total_calories, total_protein_g,
    total_carbohydrates_g, total_fat_g, presented_at, server_calculated_at
  ) values (
    v_preview_id, 1, v_user_id, p_meal_type, p_consumed_at, p_time_zone,
    btrim(p_original_description), v_total_calories, v_total_protein,
    v_total_carbohydrates, v_total_fat, v_presented_at, v_presented_at
  );

  insert into public.food_log_preview_items (
    preview_id, revision_number, user_id, ordinal, component_role,
    food_product_id, food_name, brand_name, quantity, unit,
    serving_description, serving_weight_g, calories, protein_g,
    carbohydrates_g, fat_g, provider, provider_identifier, provider_version,
    provider_retrieved_at, attribution, market_country_code, is_estimated,
    confidence, uncertainty
  ) values (
    v_preview_id, 1, v_user_id, 1, 'standalone', v_food.food_product_id,
    v_food.canonical_name, v_food.brand_name,
    v_food.serving_quantity * p_serving_count, v_food.serving_unit,
    p_serving_count::text || ' x ' || v_food.serving_description,
    case when v_food.serving_weight_g is null then null
      else v_food.serving_weight_g * p_serving_count end,
    v_total_calories, v_total_protein, v_total_carbohydrates, v_total_fat,
    v_food.provider, v_food.provider_identifier, v_food.provider_version,
    v_food.provider_retrieved_at, v_food.attribution,
    v_food.market_country_code, v_food.is_estimated, v_food.confidence,
    v_uncertainty
  );

  return query
  select
    preview.id, preview.revision_number, preview.status,
    preview.last_presented_at, preview.expires_at,
    revision.meal_type, revision.consumed_at, revision.time_zone,
    revision.original_description, revision.total_calories,
    revision.total_protein_g, revision.total_carbohydrates_g,
    revision.total_fat_g, revision.macro_data_complete,
    v_food.food_product_id, v_food.serving_id, v_food.canonical_name,
    v_food.brand_name, v_food.barcode, p_serving_count,
    v_food.serving_description, v_food.serving_unit,
    v_food.serving_weight_g, v_food.provider, v_food.provider_identifier,
    v_food.provider_version, v_food.provider_retrieved_at,
    v_food.attribution, v_food.market_country_code, v_food.market_status,
    v_food.market_warning, v_food.source_warning, v_food.is_estimated,
    v_food.confidence, v_uncertainty
  from public.chatgpt_log_previews as preview
  join public.food_log_preview_revisions as revision
    on revision.preview_id = preview.id
   and revision.revision_number = preview.revision_number
  where preview.id = v_preview_id and preview.user_id = v_user_id;
end;
$$;

create or replace function public.create_barcode_food_log_preview(
  p_scan_session_id uuid,
  p_food_product_id uuid,
  p_serving_id uuid,
  p_serving_count numeric,
  p_meal_type text,
  p_consumed_at timestamptz,
  p_time_zone text,
  p_original_description text
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, food_product_id uuid, serving_id uuid,
  food_name text, brand_name text, barcode text, serving_count numeric,
  serving_description text, serving_unit text, serving_weight_g numeric,
  provider text, provider_identifier text, provider_version text,
  provider_retrieved_at timestamptz, attribution text,
  market_country_code text, market_status text, market_warning text,
  source_warning text, is_estimated boolean, confidence numeric, uncertainty jsonb
)
language sql
security invoker
set search_path = ''
as $$ select * from private.create_barcode_food_log_preview(
  p_scan_session_id, p_food_product_id, p_serving_id, p_serving_count,
  p_meal_type, p_consumed_at, p_time_zone, p_original_description
) $$;

create or replace function private.revise_barcode_food_log_preview(
  p_preview_id uuid,
  p_expected_revision integer,
  p_serving_id uuid,
  p_serving_count numeric
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, food_product_id uuid, serving_id uuid,
  food_name text, brand_name text, barcode text, serving_count numeric,
  serving_description text, serving_unit text, serving_weight_g numeric,
  provider text, provider_identifier text, provider_version text,
  provider_retrieved_at timestamptz, attribution text,
  market_country_code text, market_status text, market_warning text,
  source_warning text, is_estimated boolean, confidence numeric, uncertainty jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_presented_at timestamptz := clock_timestamp();
  v_preview public.chatgpt_log_previews%rowtype;
  v_revision public.food_log_preview_revisions%rowtype;
  v_current_item public.food_log_preview_items%rowtype;
  v_scan public.scan_sessions%rowtype;
  v_food record;
  v_uncertainty jsonb;
  v_new_revision integer;
  v_total_calories numeric(10,2);
  v_total_protein numeric(10,3);
  v_total_carbohydrates numeric(10,3);
  v_total_fat numeric(10,3);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception using errcode = '42501', message = 'first-party authentication required';
  end if;
  if p_expected_revision is null or p_expected_revision <= 0 then
    raise exception using errcode = '22023', message = 'expected revision is invalid';
  end if;
  if p_serving_count is null or p_serving_count <= 0 or p_serving_count > 100 then
    raise exception using errcode = '22023', message = 'serving count must be greater than 0 and no more than 100';
  end if;

  select * into v_preview
  from public.chatgpt_log_previews as preview
  where preview.id = p_preview_id and preview.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'barcode preview not found for current user';
  end if;
  if v_preview.source_kind <> 'barcode' or v_preview.status <> 'ready'
    or v_preview.expires_at <= now() or v_preview.source_scan_session_id is null then
    raise exception using errcode = '55000', message = 'barcode preview is not current and ready';
  end if;
  if v_preview.revision_number <> p_expected_revision then
    raise exception using errcode = '40001', message = 'barcode preview revision is stale';
  end if;

  select * into v_revision
  from public.food_log_preview_revisions as revision
  where revision.preview_id = p_preview_id
    and revision.revision_number = p_expected_revision
    and revision.user_id = v_user_id;
  select * into v_current_item
  from public.food_log_preview_items as item
  where item.preview_id = p_preview_id
    and item.revision_number = p_expected_revision
    and item.user_id = v_user_id
    and item.ordinal = 1;
  select * into v_scan
  from public.scan_sessions as scan
  where scan.id = v_preview.source_scan_session_id and scan.user_id = v_user_id;
  if v_revision.preview_id is null or v_current_item.id is null or v_scan.id is null then
    raise exception using errcode = '55000', message = 'barcode preview lineage is incomplete';
  end if;

  select * into v_food
  from private.selected_barcode_serving(
    v_user_id, v_current_item.food_product_id, p_serving_id
  );
  if not found or v_food.barcode <> v_scan.barcode then
    raise exception using errcode = '22023', message = 'selected serving does not match the barcode product';
  end if;

  v_new_revision := p_expected_revision + 1;
  v_total_calories := (v_food.calories * p_serving_count)::numeric(10,2);
  v_total_protein := case when v_food.protein_g is null then null
    else (v_food.protein_g * p_serving_count)::numeric(10,3) end;
  v_total_carbohydrates := case when v_food.carbohydrates_g is null then null
    else (v_food.carbohydrates_g * p_serving_count)::numeric(10,3) end;
  v_total_fat := case when v_food.fat_g is null then null
    else (v_food.fat_g * p_serving_count)::numeric(10,3) end;
  v_uncertainty := private.barcode_preview_uncertainty(
    v_food.uncertainty, v_food.market_warning, v_food.source_warning
  );

  insert into public.food_log_preview_revisions (
    preview_id, revision_number, user_id, meal_type, consumed_at, time_zone,
    original_description, image_evidence_description, total_calories,
    total_protein_g, total_carbohydrates_g, total_fat_g, presented_at,
    server_calculated_at
  ) values (
    p_preview_id, v_new_revision, v_user_id, v_revision.meal_type,
    v_revision.consumed_at, v_revision.time_zone,
    v_revision.original_description, v_revision.image_evidence_description,
    v_total_calories, v_total_protein, v_total_carbohydrates, v_total_fat,
    v_presented_at, v_presented_at
  );

  insert into public.food_log_preview_items (
    preview_id, revision_number, user_id, ordinal, component_role,
    food_product_id, food_name, brand_name, quantity, unit,
    serving_description, serving_weight_g, calories, protein_g,
    carbohydrates_g, fat_g, provider, provider_identifier, provider_version,
    provider_retrieved_at, attribution, market_country_code, is_estimated,
    confidence, uncertainty
  ) values (
    p_preview_id, v_new_revision, v_user_id, 1, 'standalone',
    v_food.food_product_id, v_food.canonical_name, v_food.brand_name,
    v_food.serving_quantity * p_serving_count, v_food.serving_unit,
    p_serving_count::text || ' x ' || v_food.serving_description,
    case when v_food.serving_weight_g is null then null
      else v_food.serving_weight_g * p_serving_count end,
    v_total_calories, v_total_protein, v_total_carbohydrates, v_total_fat,
    v_food.provider, v_food.provider_identifier, v_food.provider_version,
    v_food.provider_retrieved_at, v_food.attribution,
    v_food.market_country_code, v_food.is_estimated, v_food.confidence,
    v_uncertainty
  );

  update public.chatgpt_log_previews as preview
  set revision_number = v_new_revision,
      last_presented_at = v_presented_at,
      updated_at = v_presented_at
  where preview.id = p_preview_id and preview.user_id = v_user_id;

  return query
  select
    preview.id, preview.revision_number, preview.status,
    preview.last_presented_at, preview.expires_at,
    revision.meal_type, revision.consumed_at, revision.time_zone,
    revision.original_description, revision.total_calories,
    revision.total_protein_g, revision.total_carbohydrates_g,
    revision.total_fat_g, revision.macro_data_complete,
    v_food.food_product_id, v_food.serving_id, v_food.canonical_name,
    v_food.brand_name, v_food.barcode, p_serving_count,
    v_food.serving_description, v_food.serving_unit,
    v_food.serving_weight_g, v_food.provider, v_food.provider_identifier,
    v_food.provider_version, v_food.provider_retrieved_at,
    v_food.attribution, v_food.market_country_code, v_food.market_status,
    v_food.market_warning, v_food.source_warning, v_food.is_estimated,
    v_food.confidence, v_uncertainty
  from public.chatgpt_log_previews as preview
  join public.food_log_preview_revisions as revision
    on revision.preview_id = preview.id
   and revision.revision_number = preview.revision_number
  where preview.id = p_preview_id and preview.user_id = v_user_id;
end;
$$;

create or replace function public.revise_barcode_food_log_preview(
  p_preview_id uuid,
  p_expected_revision integer,
  p_serving_id uuid,
  p_serving_count numeric
)
returns table (
  preview_id uuid, revision_number integer, status text,
  last_presented_at timestamptz, expires_at timestamptz, meal_type text,
  consumed_at timestamptz, time_zone text, original_description text,
  total_calories numeric, total_protein_g numeric,
  total_carbohydrates_g numeric, total_fat_g numeric,
  macro_data_complete boolean, food_product_id uuid, serving_id uuid,
  food_name text, brand_name text, barcode text, serving_count numeric,
  serving_description text, serving_unit text, serving_weight_g numeric,
  provider text, provider_identifier text, provider_version text,
  provider_retrieved_at timestamptz, attribution text,
  market_country_code text, market_status text, market_warning text,
  source_warning text, is_estimated boolean, confidence numeric, uncertainty jsonb
)
language sql
security invoker
set search_path = ''
as $$ select * from private.revise_barcode_food_log_preview(
  p_preview_id, p_expected_revision, p_serving_id, p_serving_count
) $$;

-- Repeat function hardening after every Phase 4 function and grant only the
-- reviewed public/private bridge pairs to authenticated callers.
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
