begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

select has_function(
  'private',
  'custom_access_token_hook',
  array['jsonb'],
  'custom access token hook is installed'
);

select ok(
  has_function_privilege(
    'supabase_auth_admin',
    'private.custom_access_token_hook(jsonb)',
    'EXECUTE'
  ),
  'Supabase Auth can execute the token hook'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.custom_access_token_hook(jsonb)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the token hook'
);

select is(
  private.custom_access_token_hook(
    '{"claims":{"sub":"11111111-1111-4111-8111-111111111111","aud":"authenticated"}}'::jsonb
  ) #>> '{claims,aud}',
  'authenticated',
  'normal mobile tokens retain the Supabase audience'
);

select is(
  private.custom_access_token_hook(
    '{"client_id":"unapproved-client","claims":{"client_id":"unapproved-client","aud":"authenticated"}}'::jsonb
  ) #>> '{claims,aud}',
  'authenticated',
  'unapproved OAuth clients retain the Supabase audience'
);

insert into private.oauth_client_action_policies (
  client_id, action, enabled, approved_at, approved_by, notes
) values (
  'approved-mcp-client', 'get_calendar_history', true, now(),
  'oauth_audience_hook.test', 'Synthetic pgTAP fixture; not a live client'
);

select is(
  private.custom_access_token_hook(
    '{"client_id":"approved-mcp-client","claims":{"client_id":"approved-mcp-client","aud":"authenticated"}}'::jsonb
  ) #>> '{claims,aud}',
  'https://locked-and-lean-mcp.vercel.app',
  'approved MCP OAuth clients receive the canonical MCP audience'
);

select throws_ok(
  $$ select private.custom_access_token_hook('{"claims":null}'::jsonb) $$,
  '22023',
  'custom access token hook requires an object claims payload',
  'malformed Auth hook events fail closed'
);

select * from finish();
rollback;
