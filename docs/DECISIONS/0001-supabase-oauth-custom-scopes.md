# ADR-0001: Supabase OAuth custom application scopes

- Status: Accepted with production blocker
- Date: 2026-07-12
- Owner: Product Architecture

## Context

The master brief proposes application scopes such as `calories:read`, `food:read`, `food:write`, `weight:read`, and `weight:write` for the ChatGPT/MCP connection.

Current Supabase OAuth 2.1 documentation lists only `openid`, `email`, `profile`, and `phone`. It explicitly states that custom scopes are not currently supported. It also states that these standard scopes control identity information in ID tokens/UserInfo, not database or API access. Supabase OAuth access tokens otherwise act like normal user tokens, include `client_id`, and can be constrained with RLS and Custom Access Token Hooks.

The Apps SDK authentication contract expects honest protected-resource metadata, OAuth discovery, resource audience binding, and per-request verification. Advertising `food:*` scopes that the issuer cannot issue or enforce would create false consent and false authorization claims.

## Decision

Locked and Lean will not advertise, request, test, or document `calories:*`, `food:*`, or `weight:*` as enforceable OAuth scopes while Supabase cannot issue custom application scopes.

For controlled development and restricted allowlisted testing, the MCP resource server will:

1. advertise only standard scopes actually exposed by the live Supabase discovery document
2. verify JWT signature, exact issuer, expected MCP audience/resource, validity window, subject, role, and `client_id` on every request
3. default-deny OAuth clients not present in a server-owned approval policy
4. map an approved `client_id` to explicit actions such as preview, confirm, food read, entry update/delete, and weight record
5. enforce ownership with `auth.uid()` and client restrictions with RLS/policy functions
6. propagate the user's bearer token to Supabase rather than substituting service role
7. record safe action audits without tokens, headers, transcripts, or full meal descriptions
8. show a consent/connection notice that application action scopes are not represented by the current OAuth scope list

The OAuth access token must carry the canonical MCP resource as its audience. A Supabase Custom Access Token Hook may set that audience from an approved `client_id`. A generic `aud = authenticated` token is rejected by the MCP resource server.

This interim policy is defense in depth, but it is not equivalent to user-consented granular scopes. ChatGPT food and weight writes remain blocked from general production release.

## Production exit criteria

The blocker may be closed only after one of these paths is approved:

### Path A: Supabase custom application scopes

- live Supabase discovery and token flows issue the required application scopes
- consent UI displays those scopes accurately
- MCP per-tool metadata requests the minimum scope set
- JWT verification and server policy enforce the granted scopes
- RLS remains the ownership boundary
- revocation and reduced-scope reauthorization tests pass

### Path B: approved replacement authorization design

- a standards-compliant authorization server supports MCP protected-resource requirements, PKCE S256, resource audience binding, ChatGPT client registration, granular consented grants, discovery, revocation, and asymmetric verification
- Supabase user identity is linked without trusting client claims
- Supabase RLS still enforces user ownership
- security review finds no critical/high issue
- MCP Inspector and end-to-end grant tests pass

In either path, tests must prove that a token with read permission cannot write, a token without weight permission cannot record weight, revoked access fails, and User A cannot access User B.

## Consequences

### Positive

- documentation and consent remain truthful
- RLS, user identity, and client policy provide a testable controlled-development boundary
- domain/tool action names can be designed now without pretending they are token scopes
- replacing the authorization provider does not require changing food-domain rules

### Negative

- general production ChatGPT writes are blocked
- users cannot grant or revoke food, calorie, and weight permissions independently through current Supabase scopes
- allowlisted `client_id` policy needs administration and audit
- dynamic client registration must default deny until each client is approved

## Rejected alternatives

- **Pretend `food:*` strings are scopes.** Rejected because the issuer neither supports nor enforces them.
- **Treat standard OIDC scopes as database permissions.** Rejected because Supabase documents that they control identity claims, not table/API access.
- **Authorize from `user_metadata`.** Rejected because it is user-editable and can be stale.
- **Use the service-role key for MCP writes.** Rejected because it bypasses RLS and destroys the required ownership boundary.
- **Trust tool annotations or ChatGPT request hints.** Rejected because they describe UX/impact and are not authorization evidence.
- **Ship broad production access with client allowlisting alone.** Rejected because it does not provide granular user-consented application permissions.

## Verification evidence

- [Supabase OAuth flows: available scopes and custom-scope limitation](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [Supabase token security: standard scopes do not control database access](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [OpenAI Apps SDK authentication requirements](https://developers.openai.com/apps-sdk/build/auth)

Re-review these sources and the live environment before Phase 6 because OAuth behavior is version-sensitive.
