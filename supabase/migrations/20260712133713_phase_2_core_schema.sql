-- Locked and Lean Phase 2 core schema.
-- Permanent diary writes are intentionally available only through the bounded
-- confirmation function at the end of this migration.

create schema if not exists private;
revoke all on schema private from public;

-- Server-owned interim authorization policy from ADR-0001. It is deliberately
-- unseeded: every OAuth client/action pair starts denied.
create table private.oauth_client_action_policies (
  client_id text not null check (length(btrim(client_id)) between 1 and 300),
  action text not null check (length(btrim(action)) between 1 and 100),
  enabled boolean not null default false,
  approved_at timestamptz,
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, action),
  constraint oauth_client_action_policies_approval_check check (
    not enabled or approved_at is not null
  )
);

revoke all on table private.oauth_client_action_policies from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  country_code text not null default 'PH' check (country_code ~ '^[A-Z]{2}$'),
  time_zone text not null default 'Asia/Manila' check (length(time_zone) between 1 and 100),
  preferred_units text not null default 'metric' check (preferred_units in ('metric')),
  birth_date date,
  formula_sex text check (formula_sex is null or formula_sex in ('female', 'male')),
  height_cm numeric(6,2) check (height_cm is null or height_cm between 50 and 300),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'retired')),
  effective_from date not null,
  effective_to date,
  calorie_target numeric(8,2) not null check (calorie_target between 1200 and 10000),
  protein_target_g numeric(8,2) not null check (protein_target_g between 0 and 1000),
  carbohydrate_target_g numeric(8,2) not null check (carbohydrate_target_g between 0 and 1500),
  fat_target_g numeric(8,2) not null check (fat_target_g between 0 and 500),
  formula_name text not null,
  formula_version text not null,
  age_years smallint not null check (age_years between 18 and 120),
  formula_sex text not null check (formula_sex in ('female', 'male')),
  height_cm numeric(6,2) not null check (height_cm between 50 and 300),
  weight_kg numeric(6,2) not null check (weight_kg between 20 and 500),
  activity_level text not null,
  activity_multiplier numeric(5,3) not null check (activity_multiplier between 1 and 3),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  goal_adjustment_kcal numeric(7,2) not null check (goal_adjustment_kcal between -2000 and 2000),
  requested_weekly_weight_change_kg numeric(5,3),
  macro_assumptions jsonb not null check (jsonb_typeof(macro_assumptions) = 'object'),
  informational_disclaimer_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_targets_effective_range_check check (
    effective_to is null or effective_to >= effective_from
  ),
  constraint nutrition_targets_requested_rate_check check (
    requested_weekly_weight_change_kg is null
    or requested_weekly_weight_change_kg between -2 and 2
  ),
  unique (id, user_id),
  unique (user_id, effective_from)
);

create unique index nutrition_targets_one_open_confirmed_idx
  on public.nutrition_targets (user_id)
  where status = 'confirmed' and effective_to is null;
create index nutrition_targets_user_effective_idx
  on public.nutrition_targets (user_id, effective_from desc, effective_to);

create table public.food_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  canonical_name text not null check (length(btrim(canonical_name)) between 1 and 300),
  brand_name text,
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  market_country_code text check (
    market_country_code is null or market_country_code ~ '^[A-Z]{2}$'
  ),
  serving_quantity numeric(12,4) not null check (serving_quantity > 0),
  serving_unit text not null check (length(btrim(serving_unit)) between 1 and 80),
  serving_weight_g numeric(12,4) check (serving_weight_g is null or serving_weight_g > 0),
  calories numeric(10,2) not null check (calories between 0 and 100000),
  protein_g numeric(10,3) not null check (protein_g between 0 and 10000),
  carbohydrates_g numeric(10,3) not null check (carbohydrates_g between 0 and 10000),
  fat_g numeric(10,3) not null check (fat_g between 0 and 10000),
  provider text not null,
  provider_identifier text,
  provider_version text,
  provider_retrieved_at timestamptz,
  attribution text,
  is_estimated boolean not null default false,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  uncertainty jsonb not null default '[]'::jsonb check (
    jsonb_typeof(uncertainty) in ('array', 'object')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index food_products_user_id_idx on public.food_products (user_id);
create index food_products_barcode_idx on public.food_products (barcode) where barcode is not null;
create index food_products_name_idx on public.food_products (lower(canonical_name));

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_product_id uuid not null references public.food_products (id) on delete cascade,
  alias text not null check (length(btrim(alias)) between 1 and 300),
  normalized_alias text not null check (length(btrim(normalized_alias)) between 1 and 300),
  language_code text not null default 'und' check (length(language_code) between 2 and 16),
  locale_code text,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  unique (food_product_id, normalized_alias, language_code)
);

create index food_aliases_product_id_idx on public.food_aliases (food_product_id);
create index food_aliases_normalized_alias_idx on public.food_aliases (normalized_alias);

create table public.restaurant_chains (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 300),
  market_country_code text not null default 'PH' check (market_country_code ~ '^[A-Z]{2}$'),
  provider text not null,
  provider_identifier text,
  source_version text,
  source_retrieved_at timestamptz,
  attribution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_identifier)
);

create table public.restaurant_menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_chain_id uuid not null references public.restaurant_chains (id) on delete cascade,
  food_product_id uuid references public.food_products (id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 300),
  market_country_code text not null default 'PH' check (market_country_code ~ '^[A-Z]{2}$'),
  serving_description text not null,
  serving_quantity numeric(12,4) not null default 1 check (serving_quantity > 0),
  serving_unit text not null,
  calories numeric(10,2) not null check (calories between 0 and 100000),
  protein_g numeric(10,3) not null check (protein_g between 0 and 10000),
  carbohydrates_g numeric(10,3) not null check (carbohydrates_g between 0 and 10000),
  fat_g numeric(10,3) not null check (fat_g between 0 and 10000),
  provider_identifier text,
  source_version text,
  source_retrieved_at timestamptz,
  is_estimated boolean not null default false,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  uncertainty jsonb not null default '[]'::jsonb check (
    jsonb_typeof(uncertainty) in ('array', 'object')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_chain_id, provider_identifier)
);

create index restaurant_menu_items_chain_id_idx
  on public.restaurant_menu_items (restaurant_chain_id);
create index restaurant_menu_items_food_product_id_idx
  on public.restaurant_menu_items (food_product_id);

create table public.restaurant_meal_components (
  id uuid primary key default gen_random_uuid(),
  meal_menu_item_id uuid not null references public.restaurant_menu_items (id) on delete cascade,
  component_menu_item_id uuid not null references public.restaurant_menu_items (id) on delete restrict,
  default_quantity numeric(12,4) not null default 1 check (default_quantity > 0),
  quantity_unit text not null default 'serving',
  is_required boolean not null default true,
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint restaurant_meal_components_not_self_check check (
    meal_menu_item_id <> component_menu_item_id
  ),
  unique (meal_menu_item_id, component_menu_item_id)
);

create index restaurant_meal_components_meal_idx
  on public.restaurant_meal_components (meal_menu_item_id);
create index restaurant_meal_components_component_idx
  on public.restaurant_meal_components (component_menu_item_id);

create table public.scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'created' check (
    status in ('created', 'preflight_approved', 'uploaded', 'processed', 'expired', 'cancelled')
  ),
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  image_width_px integer check (image_width_px is null or image_width_px between 1 and 8192),
  image_height_px integer check (image_height_px is null or image_height_px between 1 and 8192),
  upload_approved_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scan_sessions_upload_approval_check check (
    upload_approved_at is null
    or (
      status in ('preflight_approved', 'uploaded', 'processed')
      and image_width_px is not null
      and image_height_px is not null
    )
  ),
  unique (id, user_id)
);

create index scan_sessions_user_created_idx on public.scan_sessions (user_id, created_at desc);
create index scan_sessions_expiry_idx on public.scan_sessions (expires_at);

create table public.chatgpt_log_previews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_kind text not null check (source_kind in ('chatgpt', 'manual', 'barcode', 'saved_food')),
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'confirmed', 'expired', 'cancelled')
  ),
  revision_number integer not null default 1 check (revision_number > 0),
  last_presented_at timestamptz,
  user_confirmed_revision integer check (user_confirmed_revision is null or user_confirmed_revision > 0),
  confirmation_received_at timestamptz,
  expires_at timestamptz not null,
  confirmed_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatgpt_log_previews_presented_check check (
    status not in ('ready', 'confirmed') or last_presented_at is not null
  ),
  constraint chatgpt_log_previews_confirmation_check check (
    (status <> 'confirmed' and confirmed_entry_id is null)
    or (
      status = 'confirmed'
      and confirmed_entry_id is not null
      and user_confirmed_revision = revision_number
      and confirmation_received_at is not null
    )
  ),
  unique (id, user_id)
);

create index chatgpt_log_previews_user_status_idx
  on public.chatgpt_log_previews (user_id, status, expires_at);

create table public.food_log_preview_revisions (
  preview_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  user_id uuid not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  consumed_at timestamptz not null,
  time_zone text not null check (length(time_zone) between 1 and 100),
  original_description text not null check (length(btrim(original_description)) between 1 and 4000),
  image_evidence_description text,
  total_calories numeric(10,2) not null check (total_calories between 0 and 100000),
  total_protein_g numeric(10,3) not null check (total_protein_g between 0 and 10000),
  total_carbohydrates_g numeric(10,3) not null check (
    total_carbohydrates_g between 0 and 10000
  ),
  total_fat_g numeric(10,3) not null check (total_fat_g between 0 and 10000),
  presented_at timestamptz,
  server_calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (preview_id, revision_number),
  unique (preview_id, revision_number, user_id),
  constraint food_log_preview_revisions_preview_owner_fkey
    foreign key (preview_id, user_id)
    references public.chatgpt_log_previews (id, user_id)
    on delete cascade
);

alter table public.chatgpt_log_previews
  add constraint chatgpt_log_previews_current_revision_fkey
  foreign key (id, revision_number, user_id)
  references public.food_log_preview_revisions (preview_id, revision_number, user_id)
  deferrable initially deferred;

create index food_log_preview_revisions_user_idx
  on public.food_log_preview_revisions (user_id, created_at desc);

create table public.food_log_preview_items (
  id uuid primary key default gen_random_uuid(),
  preview_id uuid not null,
  revision_number integer not null,
  user_id uuid not null,
  ordinal smallint not null check (ordinal > 0),
  parent_preview_item_id uuid,
  component_role text not null default 'standalone' check (
    component_role in (
      'standalone',
      'meal',
      'rice',
      'main_dish',
      'side_dish',
      'sauce',
      'drink',
      'topping',
      'condiment'
    )
  ),
  food_product_id uuid references public.food_products (id) on delete set null,
  restaurant_chain_id uuid references public.restaurant_chains (id) on delete set null,
  restaurant_menu_item_id uuid references public.restaurant_menu_items (id) on delete set null,
  food_name text not null check (length(btrim(food_name)) between 1 and 300),
  brand_name text,
  restaurant_chain_name text,
  restaurant_item_name text,
  quantity numeric(12,4) not null check (quantity > 0),
  unit text not null check (length(btrim(unit)) between 1 and 80),
  serving_description text,
  serving_weight_g numeric(12,4) check (serving_weight_g is null or serving_weight_g > 0),
  calories numeric(10,2) not null check (calories between 0 and 100000),
  protein_g numeric(10,3) not null check (protein_g between 0 and 10000),
  carbohydrates_g numeric(10,3) not null check (carbohydrates_g between 0 and 10000),
  fat_g numeric(10,3) not null check (fat_g between 0 and 10000),
  provider text not null,
  provider_identifier text,
  provider_version text,
  provider_retrieved_at timestamptz,
  attribution text,
  market_country_code text check (
    market_country_code is null or market_country_code ~ '^[A-Z]{2}$'
  ),
  is_estimated boolean not null,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  uncertainty jsonb not null check (jsonb_typeof(uncertainty) in ('array', 'object')),
  created_at timestamptz not null default now(),
  constraint food_log_preview_items_revision_owner_fkey
    foreign key (preview_id, revision_number, user_id)
    references public.food_log_preview_revisions (preview_id, revision_number, user_id)
    on delete cascade,
  constraint food_log_preview_items_parent_shape_check check (
    (parent_preview_item_id is null and component_role in ('standalone', 'meal'))
    or (parent_preview_item_id is not null and component_role not in ('standalone', 'meal'))
  ),
  constraint food_log_preview_items_meal_container_totals_check check (
    component_role <> 'meal'
    or (calories = 0 and protein_g = 0 and carbohydrates_g = 0 and fat_g = 0)
  ),
  unique (id, preview_id, revision_number, user_id),
  constraint food_log_preview_items_parent_revision_owner_fkey
    foreign key (parent_preview_item_id, preview_id, revision_number, user_id)
    references public.food_log_preview_items (id, preview_id, revision_number, user_id)
    on delete restrict
    deferrable initially deferred,
  unique (preview_id, revision_number, ordinal)
);

create index food_log_preview_items_revision_idx
  on public.food_log_preview_items (preview_id, revision_number);
create index food_log_preview_items_user_idx on public.food_log_preview_items (user_id);
create index food_log_preview_items_parent_idx
  on public.food_log_preview_items (parent_preview_item_id)
  where parent_preview_item_id is not null;
create index food_log_preview_items_food_product_id_idx
  on public.food_log_preview_items (food_product_id);
create index food_log_preview_items_restaurant_chain_id_idx
  on public.food_log_preview_items (restaurant_chain_id);
create index food_log_preview_items_restaurant_menu_item_id_idx
  on public.food_log_preview_items (restaurant_menu_item_id);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_preview_id uuid,
  source_kind text not null check (source_kind in ('chatgpt', 'manual', 'barcode', 'saved_food')),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  consumed_at timestamptz not null,
  local_date date not null,
  time_zone text not null check (length(time_zone) between 1 and 100),
  original_description text not null check (length(btrim(original_description)) between 1 and 4000),
  total_calories numeric(10,2) not null default 0 check (total_calories between 0 and 100000),
  total_protein_g numeric(10,3) not null default 0 check (total_protein_g between 0 and 10000),
  total_carbohydrates_g numeric(10,3) not null default 0 check (
    total_carbohydrates_g between 0 and 10000
  ),
  total_fat_g numeric(10,3) not null default 0 check (total_fat_g between 0 and 10000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (source_preview_id),
  constraint food_entries_source_preview_owner_fkey
    foreign key (source_preview_id, user_id)
    references public.chatgpt_log_previews (id, user_id)
    deferrable initially deferred
);

create index food_entries_user_date_idx
  on public.food_entries (user_id, local_date desc, consumed_at desc)
  where deleted_at is null;
create index food_entries_source_preview_id_idx
  on public.food_entries (source_preview_id)
  where source_preview_id is not null;

create table public.food_entry_items (
  id uuid primary key default gen_random_uuid(),
  food_entry_id uuid not null,
  user_id uuid not null,
  ordinal smallint not null check (ordinal > 0),
  source_preview_item_id uuid,
  parent_source_preview_item_id uuid,
  parent_entry_item_id uuid,
  component_role text not null default 'standalone' check (
    component_role in (
      'standalone',
      'meal',
      'rice',
      'main_dish',
      'side_dish',
      'sauce',
      'drink',
      'topping',
      'condiment'
    )
  ),
  food_product_id uuid references public.food_products (id) on delete set null,
  restaurant_chain_id uuid references public.restaurant_chains (id) on delete set null,
  restaurant_menu_item_id uuid references public.restaurant_menu_items (id) on delete set null,
  food_name text not null check (length(btrim(food_name)) between 1 and 300),
  brand_name text,
  restaurant_chain_name text,
  restaurant_item_name text,
  quantity numeric(12,4) not null check (quantity > 0),
  unit text not null check (length(btrim(unit)) between 1 and 80),
  serving_description text,
  serving_weight_g numeric(12,4) check (serving_weight_g is null or serving_weight_g > 0),
  calories numeric(10,2) not null check (calories between 0 and 100000),
  protein_g numeric(10,3) not null check (protein_g between 0 and 10000),
  carbohydrates_g numeric(10,3) not null check (carbohydrates_g between 0 and 10000),
  fat_g numeric(10,3) not null check (fat_g between 0 and 10000),
  provider text not null,
  provider_identifier text,
  provider_version text,
  provider_retrieved_at timestamptz,
  attribution text,
  market_country_code text check (
    market_country_code is null or market_country_code ~ '^[A-Z]{2}$'
  ),
  is_estimated boolean not null,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  uncertainty jsonb not null check (jsonb_typeof(uncertainty) in ('array', 'object')),
  created_at timestamptz not null default now(),
  constraint food_entry_items_entry_owner_fkey
    foreign key (food_entry_id, user_id)
    references public.food_entries (id, user_id)
    on delete cascade,
  constraint food_entry_items_parent_shape_check check (
    (parent_entry_item_id is null and component_role in ('standalone', 'meal'))
    or (parent_entry_item_id is not null and component_role not in ('standalone', 'meal'))
  ),
  constraint food_entry_items_meal_container_totals_check check (
    component_role <> 'meal'
    or (calories = 0 and protein_g = 0 and carbohydrates_g = 0 and fat_g = 0)
  ),
  unique (id, food_entry_id, user_id),
  constraint food_entry_items_parent_entry_owner_fkey
    foreign key (parent_entry_item_id, food_entry_id, user_id)
    references public.food_entry_items (id, food_entry_id, user_id)
    on delete restrict
    deferrable initially deferred,
  unique (food_entry_id, ordinal)
);

create index food_entry_items_entry_id_idx on public.food_entry_items (food_entry_id);
create index food_entry_items_user_id_idx on public.food_entry_items (user_id);
create index food_entry_items_source_preview_item_id_idx
  on public.food_entry_items (source_preview_item_id)
  where source_preview_item_id is not null;
create index food_entry_items_parent_source_preview_item_id_idx
  on public.food_entry_items (parent_source_preview_item_id)
  where parent_source_preview_item_id is not null;
create index food_entry_items_parent_entry_item_id_idx
  on public.food_entry_items (parent_entry_item_id)
  where parent_entry_item_id is not null;
create index food_entry_items_food_product_id_idx on public.food_entry_items (food_product_id);
create index food_entry_items_restaurant_chain_id_idx
  on public.food_entry_items (restaurant_chain_id);
create index food_entry_items_restaurant_menu_item_id_idx
  on public.food_entry_items (restaurant_menu_item_id);

alter table public.chatgpt_log_previews
  add constraint chatgpt_log_previews_confirmed_entry_fkey
  foreign key (confirmed_entry_id, user_id)
  references public.food_entries (id, user_id)
  deferrable initially deferred;

create unique index chatgpt_log_previews_confirmed_entry_id_idx
  on public.chatgpt_log_previews (confirmed_entry_id)
  where confirmed_entry_id is not null;

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null,
  local_date date not null,
  time_zone text not null check (length(time_zone) between 1 and 100),
  weight_kg numeric(6,2) not null check (weight_kg between 20 and 500),
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_key)
);

create index weight_logs_user_date_idx
  on public.weight_logs (user_id, local_date desc, measured_at desc);

create table public.daily_summaries (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  nutrition_target_id uuid,
  entry_count integer not null default 0 check (entry_count >= 0),
  consumed_calories numeric(10,2) not null default 0 check (consumed_calories >= 0),
  consumed_protein_g numeric(10,3) not null default 0 check (consumed_protein_g >= 0),
  consumed_carbohydrates_g numeric(10,3) not null default 0 check (
    consumed_carbohydrates_g >= 0
  ),
  consumed_fat_g numeric(10,3) not null default 0 check (consumed_fat_g >= 0),
  calorie_target numeric(8,2),
  protein_target_g numeric(8,2),
  carbohydrate_target_g numeric(8,2),
  fat_target_g numeric(8,2),
  weight_kg numeric(6,2),
  recalculated_at timestamptz not null default now(),
  primary key (user_id, local_date),
  constraint daily_summaries_target_owner_fkey
    foreign key (nutrition_target_id, user_id)
    references public.nutrition_targets (id, user_id)
    on delete set null (nutrition_target_id)
);

create index daily_summaries_target_id_idx
  on public.daily_summaries (nutrition_target_id)
  where nutrition_target_id is not null;

create table public.mcp_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation text not null check (length(operation) between 1 and 100),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  preview_id uuid,
  confirmed_revision integer check (confirmed_revision is null or confirmed_revision > 0),
  confirmation boolean,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  result_entry_id uuid,
  response jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, operation, idempotency_key),
  constraint mcp_idempotency_keys_preview_owner_fkey
    foreign key (preview_id, user_id)
    references public.chatgpt_log_previews (id, user_id)
    on delete cascade,
  constraint mcp_idempotency_keys_entry_owner_fkey
    foreign key (result_entry_id, user_id)
    references public.food_entries (id, user_id)
    on delete set null (result_entry_id),
  constraint mcp_idempotency_keys_completion_check check (
    (status = 'completed' and result_entry_id is not null and completed_at is not null)
    or status <> 'completed'
  )
);

create index mcp_idempotency_keys_preview_id_idx
  on public.mcp_idempotency_keys (preview_id)
  where preview_id is not null;
create index mcp_idempotency_keys_result_entry_id_idx
  on public.mcp_idempotency_keys (result_entry_id)
  where result_entry_id is not null;

create table public.oauth_action_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  oauth_client_id text,
  action text not null check (length(action) between 1 and 100),
  outcome text not null check (outcome in ('succeeded', 'denied', 'failed')),
  correlation_id text,
  preview_id uuid,
  entry_id uuid,
  idempotency_outcome text check (
    idempotency_outcome is null or idempotency_outcome in ('created', 'reused', 'conflict')
  ),
  error_class text,
  created_at timestamptz not null default now(),
  constraint oauth_action_audit_preview_owner_fkey
    foreign key (preview_id, user_id)
    references public.chatgpt_log_previews (id, user_id)
    on delete set null (preview_id),
  constraint oauth_action_audit_entry_owner_fkey
    foreign key (entry_id, user_id)
    references public.food_entries (id, user_id)
    on delete set null (entry_id)
);

create index oauth_action_audit_user_created_idx
  on public.oauth_action_audit (user_id, created_at desc);
create index oauth_action_audit_preview_id_idx
  on public.oauth_action_audit (preview_id)
  where preview_id is not null;
create index oauth_action_audit_entry_id_idx
  on public.oauth_action_audit (entry_id)
  where entry_id is not null;

-- Rebuild one user's derived summary for one local date. This is intentionally
-- security invoker; callers must already be inside trusted database code.
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
    coalesce(sum(e.total_calories), 0),
    coalesce(sum(e.total_protein_g), 0),
    coalesce(sum(e.total_carbohydrates_g), 0),
    coalesce(sum(e.total_fat_g), 0)
  into v_entry_count, v_calories, v_protein, v_carbohydrates, v_fat
  from public.food_entries as e
  where e.user_id = p_user_id
    and e.local_date = p_local_date
    and e.deleted_at is null;

  select
    t.id,
    t.calorie_target,
    t.protein_target_g,
    t.carbohydrate_target_g,
    t.fat_target_g
  into
    v_target_id,
    v_target_calories,
    v_target_protein,
    v_target_carbohydrates,
    v_target_fat
  from public.nutrition_targets as t
  where t.user_id = p_user_id
    and t.status = 'confirmed'
    and t.effective_from <= p_local_date
    and (t.effective_to is null or t.effective_to >= p_local_date)
  order by t.effective_from desc, t.created_at desc
  limit 1;

  select w.weight_kg
  into v_weight
  from public.weight_logs as w
  where w.user_id = p_user_id
    and w.local_date = p_local_date
  order by w.measured_at desc, w.id desc
  limit 1;

  if v_entry_count = 0 and v_target_id is null and v_weight is null then
    delete from public.daily_summaries
    where user_id = p_user_id and local_date = p_local_date;
    return;
  end if;

  insert into public.daily_summaries (
    user_id,
    local_date,
    nutrition_target_id,
    entry_count,
    consumed_calories,
    consumed_protein_g,
    consumed_carbohydrates_g,
    consumed_fat_g,
    calorie_target,
    protein_target_g,
    carbohydrate_target_g,
    fat_target_g,
    weight_kg,
    recalculated_at
  ) values (
    p_user_id,
    p_local_date,
    v_target_id,
    v_entry_count,
    v_calories,
    v_protein,
    v_carbohydrates,
    v_fat,
    v_target_calories,
    v_target_protein,
    v_target_carbohydrates,
    v_target_fat,
    v_weight,
    now()
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

create or replace function private.on_food_entry_summary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key record;
begin
  if tg_op = 'INSERT' then
    perform private.rebuild_daily_summary(new.user_id, new.local_date);
  elsif tg_op = 'DELETE' then
    perform private.rebuild_daily_summary(old.user_id, old.local_date);
  else
    for v_key in
      select distinct x.user_id, x.local_date
      from (
        values (old.user_id, old.local_date), (new.user_id, new.local_date)
      ) as x(user_id, local_date)
      order by x.user_id, x.local_date
    loop
      perform private.rebuild_daily_summary(v_key.user_id, v_key.local_date);
    end loop;
  end if;
  return null;
end;
$$;

create trigger food_entries_rebuild_summary
after insert or update or delete on public.food_entries
for each row execute function private.on_food_entry_summary();

create or replace function private.sync_food_entry_totals()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
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
    perform 1
    from public.food_entries as e
    where e.id = v_entry_id
    for update;

    update public.food_entries as e
    set total_calories = totals.calories,
        total_protein_g = totals.protein_g,
        total_carbohydrates_g = totals.carbohydrates_g,
        total_fat_g = totals.fat_g,
        updated_at = now()
    from (
      select
        coalesce(sum(i.calories), 0)::numeric(10,2) as calories,
        coalesce(sum(i.protein_g), 0)::numeric(10,3) as protein_g,
        coalesce(sum(i.carbohydrates_g), 0)::numeric(10,3) as carbohydrates_g,
        coalesce(sum(i.fat_g), 0)::numeric(10,3) as fat_g
      from public.food_entry_items as i
      where i.food_entry_id = v_entry_id
    ) as totals
    where e.id = v_entry_id;
  end loop;
  return null;
end;
$$;

-- Transition-table names must exist for every operation referenced by the
-- shared trigger function, so each trigger supplies an empty counterpart via
-- an operation-specific wrapper.
create or replace function private.sync_food_entry_totals_after_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
begin
  for v_entry_id in
    select distinct n.food_entry_id from new_rows as n order by n.food_entry_id
  loop
    perform 1 from public.food_entries as e where e.id = v_entry_id for update;
    update public.food_entries as e
    set total_calories = totals.calories,
        total_protein_g = totals.protein_g,
        total_carbohydrates_g = totals.carbohydrates_g,
        total_fat_g = totals.fat_g,
        updated_at = now()
    from (
      select
        coalesce(sum(i.calories), 0)::numeric(10,2) as calories,
        coalesce(sum(i.protein_g), 0)::numeric(10,3) as protein_g,
        coalesce(sum(i.carbohydrates_g), 0)::numeric(10,3) as carbohydrates_g,
        coalesce(sum(i.fat_g), 0)::numeric(10,3) as fat_g
      from public.food_entry_items as i where i.food_entry_id = v_entry_id
    ) as totals
    where e.id = v_entry_id;
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
declare
  v_entry_id uuid;
begin
  for v_entry_id in
    select distinct o.food_entry_id from old_rows as o order by o.food_entry_id
  loop
    perform 1 from public.food_entries as e where e.id = v_entry_id for update;
    update public.food_entries as e
    set total_calories = totals.calories,
        total_protein_g = totals.protein_g,
        total_carbohydrates_g = totals.carbohydrates_g,
        total_fat_g = totals.fat_g,
        updated_at = now()
    from (
      select
        coalesce(sum(i.calories), 0)::numeric(10,2) as calories,
        coalesce(sum(i.protein_g), 0)::numeric(10,3) as protein_g,
        coalesce(sum(i.carbohydrates_g), 0)::numeric(10,3) as carbohydrates_g,
        coalesce(sum(i.fat_g), 0)::numeric(10,3) as fat_g
      from public.food_entry_items as i where i.food_entry_id = v_entry_id
    ) as totals
    where e.id = v_entry_id;
  end loop;
  return null;
end;
$$;

create trigger food_entry_items_sync_totals_insert
after insert on public.food_entry_items
referencing new table as new_rows
for each statement execute function private.sync_food_entry_totals_after_insert();

create trigger food_entry_items_sync_totals_delete
after delete on public.food_entry_items
referencing old table as old_rows
for each statement execute function private.sync_food_entry_totals_after_delete();

create trigger food_entry_items_sync_totals_update
after update on public.food_entry_items
referencing old table as old_rows new table as new_rows
for each statement execute function private.sync_food_entry_totals();

create or replace function private.on_weight_log_summary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key record;
begin
  if tg_op = 'INSERT' then
    perform private.rebuild_daily_summary(new.user_id, new.local_date);
  elsif tg_op = 'DELETE' then
    perform private.rebuild_daily_summary(old.user_id, old.local_date);
  else
    for v_key in
      select distinct x.user_id, x.local_date
      from (
        values (old.user_id, old.local_date), (new.user_id, new.local_date)
      ) as x(user_id, local_date)
      order by x.user_id, x.local_date
    loop
      perform private.rebuild_daily_summary(v_key.user_id, v_key.local_date);
    end loop;
  end if;
  return null;
end;
$$;

create trigger weight_logs_rebuild_summary
after insert or update or delete on public.weight_logs
for each row execute function private.on_weight_log_summary();

create or replace function private.on_nutrition_target_summary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_start date;
  v_end date;
  v_date date;
begin
  if tg_op = 'INSERT' then
    v_user_id := new.user_id;
    v_start := new.effective_from;
    v_end := coalesce(new.effective_to, current_date);
  elsif tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_start := old.effective_from;
    v_end := coalesce(old.effective_to, current_date);
  else
    v_user_id := new.user_id;
    v_start := least(new.effective_from, old.effective_from);
    v_end := greatest(
      coalesce(new.effective_to, current_date),
      coalesce(old.effective_to, current_date)
    );
  end if;

  for v_date in
    select distinct dates.local_date
    from (
      select s.local_date
      from public.daily_summaries as s
      where s.user_id = v_user_id and s.local_date between v_start and v_end
      union
      select e.local_date
      from public.food_entries as e
      where e.user_id = v_user_id and e.local_date between v_start and v_end
      union
      select w.local_date
      from public.weight_logs as w
      where w.user_id = v_user_id and w.local_date between v_start and v_end
      union
      select v_start
    ) as dates
    order by dates.local_date
  loop
    perform private.rebuild_daily_summary(v_user_id, v_date);
  end loop;
  return null;
end;
$$;

create trigger nutrition_targets_rebuild_summaries
after insert or update or delete on public.nutrition_targets
for each row execute function private.on_nutrition_target_summary();

-- The privileged helper is required because authenticated clients have no
-- direct INSERT/UPDATE/DELETE grants on permanent diary or summary tables.
-- It lives only in a non-exposed schema and re-verifies auth.uid().
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
  v_oauth_client_id text := (select auth.jwt()) ->> 'client_id';
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
  if v_oauth_client_id is null or not exists (
    select 1
    from private.oauth_client_action_policies as policy
    where policy.client_id = v_oauth_client_id
      and policy.action = 'confirm_food_log'
      and policy.enabled
  ) then
    raise exception using
      errcode = '42501',
      message = 'oauth client is not authorized for this action';
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

  -- Check ownership before inserting an idempotency row whose composite
  -- foreign key includes the preview owner. Without this non-mutating check,
  -- a cross-user preview ID leaks a foreign-key error instead of the stable
  -- authorization response. Completed safe retries still pass because their
  -- owned preview remains present even after it becomes confirmed.
  perform 1
  from public.chatgpt_log_previews as p
  where p.id = p_preview_id
    and p.user_id = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'preview not found';
  end if;

  insert into public.mcp_idempotency_keys (
    user_id,
    operation,
    idempotency_key,
    preview_id,
    confirmed_revision,
    confirmation,
    status
  ) values (
    v_user_id,
    'confirm_food_log',
    p_idempotency_key,
    p_preview_id,
    p_confirmed_revision,
    true,
    'processing'
  )
  on conflict (user_id, operation, idempotency_key) do nothing;

  select k.*
  into strict v_idempotency
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
    -- A completed row is locked above, so this audit and the safe-retry result
    -- are committed together without exposing meal text, tokens, or headers.
    insert into public.oauth_action_audit (
      user_id,
      oauth_client_id,
      action,
      outcome,
      preview_id,
      entry_id,
      idempotency_outcome
    ) values (
      v_user_id,
      v_oauth_client_id,
      'confirm_food_log',
      'succeeded',
      v_idempotency.preview_id,
      v_idempotency.result_entry_id,
      'reused'
    );

    return query
    select
      e.id,
      true,
      e.local_date,
      e.total_calories,
      e.total_protein_g,
      e.total_carbohydrates_g,
      e.total_fat_g
    from public.food_entries as e
    where e.id = v_idempotency.result_entry_id
      and e.user_id = v_user_id;
    return;
  end if;

  select p.*
  into v_preview
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

  select r.*
  into strict v_revision
  from public.food_log_preview_revisions as r
  where r.preview_id = v_preview.id
    and r.revision_number = v_preview.revision_number
    and r.user_id = v_user_id;

  if v_revision.presented_at is null
    or v_revision.presented_at <> v_preview.last_presented_at then
    raise exception using errcode = 'P0001', message = 'current preview revision was not presented';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names as tz where tz.name = v_revision.time_zone
  ) then
    raise exception using errcode = '22023', message = 'preview timezone is invalid';
  end if;

  select
    count(*)::integer,
    coalesce(sum(i.calories), 0)::numeric(10,2),
    coalesce(sum(i.protein_g), 0)::numeric(10,3),
    coalesce(sum(i.carbohydrates_g), 0)::numeric(10,3),
    coalesce(sum(i.fat_g), 0)::numeric(10,3)
  into v_item_count, v_calories, v_protein, v_carbohydrates, v_fat
  from public.food_log_preview_items as i
  where i.preview_id = v_preview.id
    and i.revision_number = v_preview.revision_number
    and i.user_id = v_user_id;

  if v_item_count < 1 then
    raise exception using errcode = 'P0001', message = 'preview has no items';
  end if;

  v_local_date := (v_revision.consumed_at at time zone v_revision.time_zone)::date;
  v_entry_id := gen_random_uuid();

  insert into public.food_entries (
    id,
    user_id,
    source_preview_id,
    source_kind,
    meal_type,
    consumed_at,
    local_date,
    time_zone,
    original_description
  ) values (
    v_entry_id,
    v_user_id,
    v_preview.id,
    v_preview.source_kind,
    v_revision.meal_type,
    v_revision.consumed_at,
    v_local_date,
    v_revision.time_zone,
    v_revision.original_description
  );

  -- Entry-item IDs deliberately retain their source preview-item IDs. This
  -- gives every child a deterministic parent_entry_item_id while the separate
  -- source columns preserve the immutable preview lineage.
  insert into public.food_entry_items (
    id,
    food_entry_id,
    user_id,
    ordinal,
    source_preview_item_id,
    parent_source_preview_item_id,
    parent_entry_item_id,
    component_role,
    food_product_id,
    restaurant_chain_id,
    restaurant_menu_item_id,
    food_name,
    brand_name,
    restaurant_chain_name,
    restaurant_item_name,
    quantity,
    unit,
    serving_description,
    serving_weight_g,
    calories,
    protein_g,
    carbohydrates_g,
    fat_g,
    provider,
    provider_identifier,
    provider_version,
    provider_retrieved_at,
    attribution,
    market_country_code,
    is_estimated,
    confidence,
    uncertainty
  )
  select
    i.id,
    v_entry_id,
    v_user_id,
    i.ordinal,
    i.id,
    i.parent_preview_item_id,
    i.parent_preview_item_id,
    i.component_role,
    i.food_product_id,
    i.restaurant_chain_id,
    i.restaurant_menu_item_id,
    i.food_name,
    i.brand_name,
    i.restaurant_chain_name,
    i.restaurant_item_name,
    i.quantity,
    i.unit,
    i.serving_description,
    i.serving_weight_g,
    i.calories,
    i.protein_g,
    i.carbohydrates_g,
    i.fat_g,
    i.provider,
    i.provider_identifier,
    i.provider_version,
    i.provider_retrieved_at,
    i.attribution,
    i.market_country_code,
    i.is_estimated,
    i.confidence,
    i.uncertainty
  from public.food_log_preview_items as i
  where i.preview_id = v_preview.id
    and i.revision_number = v_preview.revision_number
    and i.user_id = v_user_id
  order by i.ordinal;

  if not exists (
    select 1
    from public.food_entries as e
    where e.id = v_entry_id
      and e.total_calories = v_calories
      and e.total_protein_g = v_protein
      and e.total_carbohydrates_g = v_carbohydrates
      and e.total_fat_g = v_fat
  ) then
    raise exception using errcode = 'P0001', message = 'entry total recalculation failed';
  end if;

  update public.chatgpt_log_previews
  set status = 'confirmed',
      user_confirmed_revision = p_confirmed_revision,
      confirmation_received_at = now(),
      confirmed_entry_id = v_entry_id,
      updated_at = now()
  where id = v_preview.id and user_id = v_user_id;

  update public.mcp_idempotency_keys
  set status = 'completed',
      result_entry_id = v_entry_id,
      response = jsonb_build_object(
        'entry_id', v_entry_id,
        'local_date', v_local_date,
        'total_calories', v_calories,
        'total_protein_g', v_protein,
        'total_carbohydrates_g', v_carbohydrates,
        'total_fat_g', v_fat
      ),
      completed_at = now()
  where id = v_idempotency.id;

  insert into public.oauth_action_audit (
    user_id,
    oauth_client_id,
    action,
    outcome,
    preview_id,
    entry_id,
    idempotency_outcome
  ) values (
    v_user_id,
    v_oauth_client_id,
    'confirm_food_log',
    'succeeded',
    v_preview.id,
    v_entry_id,
    'created'
  );

  return query
  select
    e.id,
    false,
    e.local_date,
    e.total_calories,
    e.total_protein_g,
    e.total_carbohydrates_g,
    e.total_fat_g
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
as $$
  select *
  from private.confirm_food_log(
    p_preview_id,
    p_confirmed_revision,
    p_confirmation,
    p_idempotency_key
  );
$$;

create or replace function private.rebuild_my_daily_summaries(
  p_start_date date,
  p_end_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_date date;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'invalid summary rebuild range';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception using errcode = '22023', message = 'summary rebuild range is too large';
  end if;

  for v_date in
    select d::date
    from generate_series(p_start_date, p_end_date, interval '1 day') as d
    order by d
  loop
    perform private.rebuild_daily_summary(v_user_id, v_date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.rebuild_my_daily_summaries(
  p_start_date date,
  p_end_date date
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.rebuild_my_daily_summaries(p_start_date, p_end_date);
$$;

-- RLS is enabled on every table in the exposed public schema.
alter table public.profiles enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.food_products enable row level security;
alter table public.food_aliases enable row level security;
alter table public.restaurant_chains enable row level security;
alter table public.restaurant_menu_items enable row level security;
alter table public.restaurant_meal_components enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.chatgpt_log_previews enable row level security;
alter table public.food_log_preview_revisions enable row level security;
alter table public.food_log_preview_items enable row level security;
alter table public.food_entries enable row level security;
alter table public.food_entry_items enable row level security;
alter table public.weight_logs enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.mcp_idempotency_keys enable row level security;
alter table public.oauth_action_audit enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = user_id);

create policy nutrition_targets_select_own on public.nutrition_targets
for select to authenticated
using ((select auth.uid()) = user_id);

create policy food_products_select_catalog_or_own on public.food_products
for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);

create policy food_aliases_select_catalog_or_own on public.food_aliases
for select to authenticated
using (
  exists (
    select 1
    from public.food_products as p
    where p.id = food_product_id
      and (p.user_id is null or p.user_id = (select auth.uid()))
  )
);

create policy restaurant_chains_select_catalog on public.restaurant_chains
for select to authenticated using (true);

create policy restaurant_menu_items_select_catalog on public.restaurant_menu_items
for select to authenticated using (true);

create policy restaurant_meal_components_select_catalog on public.restaurant_meal_components
for select to authenticated using (true);

create policy scan_sessions_select_own on public.scan_sessions
for select to authenticated
using ((select auth.uid()) = user_id);

create policy chatgpt_log_previews_select_own on public.chatgpt_log_previews
for select to authenticated
using ((select auth.uid()) = user_id);

create policy food_log_preview_revisions_select_own on public.food_log_preview_revisions
for select to authenticated
using ((select auth.uid()) = user_id);

create policy food_log_preview_items_select_own on public.food_log_preview_items
for select to authenticated
using ((select auth.uid()) = user_id);

create policy food_entries_select_own on public.food_entries
for select to authenticated
using ((select auth.uid()) = user_id);

create policy food_entry_items_select_own on public.food_entry_items
for select to authenticated
using ((select auth.uid()) = user_id);

create policy weight_logs_select_own on public.weight_logs
for select to authenticated
using ((select auth.uid()) = user_id);

create policy daily_summaries_select_own on public.daily_summaries
for select to authenticated
using ((select auth.uid()) = user_id);

create policy mcp_idempotency_keys_select_own on public.mcp_idempotency_keys
for select to authenticated
using ((select auth.uid()) = user_id);

create policy oauth_action_audit_select_own on public.oauth_action_audit
for select to authenticated
using ((select auth.uid()) = user_id);

-- Explicit grants are required for new projects whose Data API no longer
-- auto-exposes SQL-created public tables. Permanent writes remain RPC-only.
revoke all on table
  public.profiles,
  public.nutrition_targets,
  public.food_products,
  public.food_aliases,
  public.restaurant_chains,
  public.restaurant_menu_items,
  public.restaurant_meal_components,
  public.scan_sessions,
  public.chatgpt_log_previews,
  public.food_log_preview_revisions,
  public.food_log_preview_items,
  public.food_entries,
  public.food_entry_items,
  public.weight_logs,
  public.daily_summaries,
  public.mcp_idempotency_keys,
  public.oauth_action_audit
from anon, authenticated;

grant select on table
  public.profiles,
  public.nutrition_targets,
  public.food_products,
  public.food_aliases,
  public.restaurant_chains,
  public.restaurant_menu_items,
  public.restaurant_meal_components,
  public.scan_sessions,
  public.chatgpt_log_previews,
  public.food_log_preview_revisions,
  public.food_log_preview_items,
  public.food_entries,
  public.food_entry_items,
  public.weight_logs,
  public.daily_summaries,
  public.mcp_idempotency_keys,
  public.oauth_action_audit
to authenticated;

-- PostgreSQL grants function EXECUTE to PUBLIC by default. Remove inherited
-- and explicit execute rights across the application schemas before granting
-- the four reviewed call paths below. Apply the same rule to future functions
-- created by the migration owner.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
-- Function EXECUTE is granted to PUBLIC by the role-global default ACL.
-- A schema-scoped REVOKE only reverses schema-scoped grants and cannot
-- override that global default, so this must intentionally omit IN SCHEMA.
alter default privileges for role postgres
  revoke execute on functions from public;

grant usage on schema private to authenticated;
grant execute on function private.confirm_food_log(uuid, integer, boolean, text) to authenticated;
grant execute on function private.rebuild_my_daily_summaries(date, date) to authenticated;
grant execute on function public.confirm_food_log(uuid, integer, boolean, text) to authenticated;
grant execute on function public.rebuild_my_daily_summaries(date, date) to authenticated;

-- Optional meal-image storage. Bucket limits enforce type and size. Direct
-- uploads additionally require a trusted preflight record containing decoded
-- pixel dimensions; users cannot approve that record through table grants.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'meal-images',
  'meal-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy meal_images_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.scan_sessions as s
    where s.user_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[2]
  )
);

create policy meal_images_insert_after_preflight
on storage.objects for insert to authenticated
with check (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) >= 3
  and exists (
    select 1
    from public.scan_sessions as s
    where s.user_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[2]
      and s.status = 'preflight_approved'
      and s.upload_approved_at is not null
      and s.expires_at > now()
      and s.image_width_px between 1 and 8192
      and s.image_height_px between 1 and 8192
  )
);

create policy meal_images_update_after_preflight
on storage.objects for update to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) >= 3
  and exists (
    select 1
    from public.scan_sessions as s
    where s.user_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[2]
      and s.status = 'preflight_approved'
      and s.upload_approved_at is not null
      and s.expires_at > now()
      and s.image_width_px between 1 and 8192
      and s.image_height_px between 1 and 8192
  )
);

create policy meal_images_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
