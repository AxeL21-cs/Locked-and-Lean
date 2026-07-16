# MCP OAuth security contract

Locked and Lean defaults to denying every protected tool. A user-data request
is accepted only when the runtime has a canonical HTTPS resource, issuer, JWKS
endpoint, exact audience, asymmetric algorithm allowlist, and explicit
client/action policy.

## Discovery and challenges

The server publishes RFC 9728 protected-resource metadata at
`/.well-known/oauth-protected-resource` only when the canonical resource and
authorization server are configured. It advertises `openid` only; it does not
invent food or weight scopes that the issuer cannot issue.

Malformed HTTP authorization returns `401` with `WWW-Authenticate`. A protected
MCP tool without acceptable authorization returns an error result containing
`_meta["mcp/www_authenticate"]`. Challenges point to the protected-resource
metadata URL and do not include tokens or backend error bodies.

An expired/rejected access token still receives an authentication challenge so
ChatGPT can refresh or reauthorize. By contrast, an exact client-policy denial
or a repository `403` returns a stable authorization error without
`mcp/www_authenticate`: reconnecting cannot change a server-owned allowlist, and
challenging those responses creates a misleading reconnect loop.

## Session persistence and client reuse

The hosted authorization-server discovery currently advertises authorization
code, refresh-token, PKCE S256, public/confidential token authentication, and a
dynamic registration endpoint. The protected-resource document points to the
same exact issuer and canonical resource. Supabase's OAuth refresh flow rotates
refresh tokens, so clients must store the replacement returned by each refresh.

The custom access-token hook reads the OAuth `client_id` from either the hook
event or its claims. Supabase documents `client_id` as an OAuth access-token
claim and `token_refresh` as a hook authentication method, so the hook is
structured to preserve the MCP audience on refresh. A live refresh-token round
trip remains required before this can be marked verified; no real refresh token
is stored in the repository or test fixtures.

Dynamic registration creates a client ID that must be reused for that connector
instance. Because both the MCP runtime and database are default-deny by exact
client ID, a newly registered ID is not usable until an administrator approves
that same ID in both `MCP_ALLOWED_CLIENT_ACTIONS` and
`private.oauth_client_action_policies`. Recreating the connector can create a
new DCR client and repeat that approval problem. For a controlled personal
deployment, a predefined stable OAuth client configured in ChatGPT and approved
before linking avoids that DCR bootstrap cycle. Do not broadly approve every
dynamically registered client.

## Token verification

`JwtAccessTokenVerifier` verifies every protected request using the issuer's
JWKS and an asymmetric allowlist (`RS256`, `PS256`, and/or `ES256`). It requires:

- valid signature and exact configured issuer;
- exactly one audience, equal to the canonical MCP resource;
- an optional `resource` claim, when present, equal to that same resource;
- current `exp`, `nbf`, and `iat` with bounded clock tolerance;
- a UUID-shaped subject and exact `authenticated` role;
- a non-empty `client_id` and the standard `openid` scope; and
- an explicit match in `MCP_ALLOWED_CLIENT_ACTIONS` for that client and tool.

The client/action policy is server-side authorization, not a substitute for
OAuth scopes. Supabase RLS and the reviewed RPC authorization checks remain the
ownership boundary. Repository calls use the user's bearer token plus the
publishable key; the MCP server has no service-role credential.

## Required environment

| Variable                     | Meaning                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `MCP_PUBLIC_BASE_URL`        | Canonical HTTPS MCP resource origin                        |
| `MCP_AUTH_ISSUER`            | Exact HTTPS JWT issuer origin                              |
| `MCP_JWKS_URI`               | HTTPS issuer JWKS URL                                      |
| `MCP_EXPECTED_AUDIENCE`      | Must equal `MCP_PUBLIC_BASE_URL`                           |
| `MCP_AUTH_ALGORITHMS`        | Comma-separated asymmetric allowlist                       |
| `MCP_ALLOWED_CLIENT_ACTIONS` | JSON object mapping exact client IDs to exact tool actions |
| `SUPABASE_URL`               | HTTPS Supabase project origin                              |
| `SUPABASE_PUBLISHABLE_KEY`   | Public/publishable client key                              |

Phase 6 is not hosted-OAuth ready. The current Supabase configuration cannot
issue the desired application scopes/contracts for the preview workflow, and
hosted issuer/audience/JWKS behavior has not been verified end to end. Health
therefore remains `degraded` or `locked`, never production-ready.

Reference: [Authenticate with OAuth](https://developers.openai.com/apps-sdk/build/auth).
