-- Bind access tokens for approved OAuth clients to the canonical hosted MCP
-- resource. Supabase Auth invokes this hook before signing a token.
create or replace function private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := event -> 'claims';
  v_client_id text := coalesce(event ->> 'client_id', v_claims ->> 'client_id');
  v_mcp_audience constant text := 'https://locked-and-lean-mcp.vercel.app';
begin
  if jsonb_typeof(v_claims) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'custom access token hook requires an object claims payload';
  end if;

  -- A client is MCP-approved only after at least one action has been explicitly
  -- enabled in the server-owned policy table. Normal mobile sessions and
  -- unapproved OAuth clients retain Supabase's original audience.
  if v_client_id is not null and exists (
    select 1
    from private.oauth_client_action_policies as policy
    where policy.client_id = v_client_id
      and policy.enabled
  ) then
    v_claims := jsonb_set(v_claims, '{aud}', to_jsonb(v_mcp_audience), true);
  end if;

  return jsonb_set(event, '{claims}', v_claims, true);
end;
$$;

revoke all on function private.custom_access_token_hook(jsonb)
from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.custom_access_token_hook(jsonb)
to supabase_auth_admin;
