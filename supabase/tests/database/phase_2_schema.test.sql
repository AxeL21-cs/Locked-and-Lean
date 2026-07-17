begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

create function private.phase_2_default_acl_probe()
returns integer
language sql
as $$ select 1 $$;

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'nutrition_targets', 'nutrition_targets exists');
select has_table('public', 'food_products', 'food_products exists');
select has_table('public', 'food_aliases', 'food_aliases exists');
select has_table('public', 'restaurant_chains', 'restaurant_chains exists');
select has_table('public', 'restaurant_menu_items', 'restaurant_menu_items exists');
select has_table('public', 'restaurant_meal_components', 'restaurant_meal_components exists');
select has_table('public', 'food_entries', 'food_entries exists');
select has_table('public', 'food_entry_items', 'food_entry_items exists');
select has_table('public', 'weight_logs', 'weight_logs exists');
select has_table('public', 'daily_summaries', 'daily_summaries exists');
select has_table('public', 'scan_sessions', 'scan_sessions exists');
select has_table('public', 'chatgpt_log_previews', 'chatgpt_log_previews exists');
select has_table('public', 'mcp_idempotency_keys', 'mcp_idempotency_keys exists');
select has_table('public', 'oauth_action_audit', 'oauth_action_audit exists');
select has_table('public', 'food_log_preview_revisions', 'preview revisions exist');
select has_table('public', 'food_log_preview_items', 'preview items exist');

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'profiles',
        'nutrition_targets',
        'food_products',
        'food_aliases',
        'restaurant_chains',
        'restaurant_menu_items',
        'restaurant_meal_components',
        'scan_sessions',
        'chatgpt_log_previews',
        'food_log_preview_revisions',
        'food_log_preview_items',
        'food_entries',
        'food_entry_items',
        'weight_logs',
        'daily_summaries',
        'mcp_idempotency_keys',
        'oauth_action_audit'
      )
      and c.relrowsecurity
  ),
  17,
  'RLS is enabled on every exposed application table'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  ),
  0,
  'no public function is SECURITY DEFINER'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('confirm_food_log', 'rebuild_my_daily_summaries')
      and p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
  ),
  2,
  'privileged helpers are private and have an empty search_path'
);

select is(
  (
    select array_agg(matches.role[1] order by matches.role[1])
    from pg_catalog.pg_constraint as c
    cross join lateral regexp_matches(
      pg_catalog.pg_get_constraintdef(c.oid),
      '''([^'']+)''::text',
      'g'
    ) as matches(role)
    where c.conname = 'food_log_preview_items_component_role_check'
  ),
  array[
    'condiment', 'drink', 'main_dish', 'meal', 'rice', 'sauce', 'side_dish',
    'standalone', 'topping'
  ]::text[],
  'preview component roles match the canonical domain schema exactly'
);

select is(
  (
    select array_agg(matches.role[1] order by matches.role[1])
    from pg_catalog.pg_constraint as c
    cross join lateral regexp_matches(
      pg_catalog.pg_get_constraintdef(c.oid),
      '''([^'']+)''::text',
      'g'
    ) as matches(role)
    where c.conname = 'food_entry_items_component_role_check'
  ),
  array[
    'condiment', 'drink', 'main_dish', 'meal', 'rice', 'sauce', 'side_dish',
    'standalone', 'topping'
  ]::text[],
  'entry component roles match the canonical domain schema exactly'
);

select ok(
  not has_table_privilege('authenticated', 'public.food_entries', 'INSERT'),
  'authenticated cannot insert permanent entries directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.confirm_food_log(uuid,integer,boolean,text)',
    'EXECUTE'
  ),
  'authenticated may execute only the bounded public confirmation wrapper'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.confirm_food_log(uuid,integer,boolean,text)',
    'EXECUTE'
  ),
  'anon and inherited PUBLIC privileges cannot execute confirmation'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  25,
  'authenticated can execute only the reviewed private bridge functions, including goal setup'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.sync_food_entry_totals_after_insert()',
    'EXECUTE'
  ),
  'authenticated cannot execute internal trigger helpers'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) as acl
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'phase_2_default_acl_probe'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'future private functions do not inherit role-global PUBLIC execute'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_default_acl as defaults
    join pg_catalog.pg_roles as owner
      on owner.oid = defaults.defaclrole
    where owner.rolname = 'postgres'
      and defaults.defaclnamespace = 0
      and defaults.defaclobjtype = 'f'
      and not exists (
        select 1
        from pg_catalog.aclexplode(defaults.defaclacl) as acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
  ),
  'postgres role-global function defaults revoke PUBLIC execute'
);

select is(
  (select b.public from storage.buckets as b where b.id = 'meal-images'),
  false,
  'meal image bucket is private'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies as p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname like 'meal_images_%'
  ),
  4,
  'private meal images have select/insert/update/delete policies'
);

select is(
  (select count(*)::integer from private.oauth_client_action_policies),
  0,
  'OAuth client action policy starts default-deny with no permissive seed'
);

select * from finish();
rollback;
