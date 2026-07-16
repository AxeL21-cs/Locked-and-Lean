# MCP security testing and response runbook

Status: Phase 6 local and hosted restricted-client security specification. The endpoint and exact allowlist are deployed, but a real ChatGPT confirmation, post-expiry refresh/revocation test, MCP Inspector result, and general-production approval remain outstanding.

## Production authorization blocker

Supabase OAuth currently supports only `openid`, `email`, `profile`, and `phone`. Its documentation states that custom scopes are not supported and that OAuth access tokens otherwise have the same user-data access as regular session tokens, with an added `client_id`. Therefore:

- do not advertise, request, mint, or claim enforcement of `calories:*`, `food:*`, or `weight:*`;
- standard OIDC scopes may identify the user but do not express granular consent for food or weight actions;
- every protected tool must still verify its token and pass an exact server-owned `(client_id, action)` policy check;
- the policy table must remain empty/default-deny until an administrator explicitly approves a client and action; and
- general production ChatGPT food or weight writes remain blocked under ADR-0001.

Tool annotations and Apps SDK metadata are UX/risk declarations, not authorization evidence. RLS remains the ownership boundary.

## Required discovery and challenge contracts

The MCP server must expose OAuth Protected Resource Metadata at the well-known endpoint for its canonical MCP resource. Local contract tests must verify:

- `resource` exactly equals the configured public MCP resource URI;
- `authorization_servers` contains the configured Supabase issuer and no untrusted issuer;
- `scopes_supported` contains only standard scopes the issuer actually supports;
- custom application scopes never appear in protected-resource metadata, tool descriptors, challenges, or consent fixtures;
- a malformed HTTP `Authorization` header returns `401 Unauthorized`, while unauthenticated MCP discovery can still expose per-tool auth metadata;
- the HTTP `WWW-Authenticate` value uses the `Bearer` scheme and includes the exact `resource_metadata` URL; and
- a protected tool authentication error is an MCP error result with `isError: true` and `_meta["mcp/www_authenticate"]`, including a safe `error` and `error_description` without echoing the token.

Apps SDK tool descriptors must declare `securitySchemes` per tool and mirror the declaration in `_meta.securitySchemes` for compatibility. A health-only surface may use `noauth`; no user record or protected repository call may be reachable through it.

## Tool annotation matrix

Annotations must describe behavior truthfully and must not be used to authorize calls.

| Tool behavior                           | `readOnlyHint` |                         `destructiveHint` |                                                     `idempotentHint` | `openWorldHint` |
| --------------------------------------- | -------------: | ----------------------------------------: | -------------------------------------------------------------------: | --------------: |
| owned summaries, calendar, recent foods |         `true` |                                   `false` |                                                               `true` |         `false` |
| preview creation or revision            |        `false` |                                   `false` |                                  only when request binding proves it |         `false` |
| exact confirmation                      |        `false` |                                   `false` |                             `true` with the required idempotency key |         `false` |
| entry copy or weight recording          |        `false` |                                   `false` | `true` only when the request includes a server-bound idempotency key |         `false` |
| entry update                            |        `false` | `true` when it replaces confirmed history |                                  only when request binding proves it |         `false` |
| entry deletion                          |        `false` |                                    `true` |               `true` only for an identical already-completed request |         `false` |

If the implementation cannot prove the idempotency property, the annotation must remain `false` even if the database often returns the same result.

## Synthetic token adversarial matrix

Token fixtures must be generated locally from an explicitly synthetic asymmetric key pair. They must use impossible production issuer/resource/client values and must never be copied from a real session.

The verifier must accept only a fully valid fixture and reject each independent mutation:

1. missing bearer token;
2. malformed compact JWT;
3. altered payload with the original signature;
4. unknown key ID or an algorithm outside the configured asymmetric allowlist;
5. wrong or missing issuer;
6. wrong or missing audience/resource, including a generic `authenticated` audience;
7. expired `exp`;
8. future `nbf`;
9. missing or invalid `sub`;
10. role other than the configured authenticated role;
11. missing or unknown `client_id`;
12. absent required standard scope;
13. valid client with no action row;
14. valid client approved for a different action; and
15. disabled exact client/action row.

Tests must prove the repository is not called after any rejection. Error responses and logs must not contain the compact token, bearer header, JWT signature, refresh token, authorization code, PKCE verifier, or raw claims object.

Revocation is a production blocker unless the deployed design can demonstrate that a revoked user grant/session stops sensitive tool use within the approved window. A locally signed token test proves cryptographic validation, not hosted revocation behavior.

## Preview, revision, and permanent-write matrix

The database exposes bounded OAuth-only preview creation and complete-snapshot revision RPCs. Both derive the owner from `auth.uid()`, require an exact enabled client/action policy, force ChatGPT interpretation provenance and estimate warnings, calculate aggregate totals from stored items, and return `permanent_write: false`. Only canonical confirmation can create a diary entry.

Repository fixtures are synthetic local adapters. Current local tests prove:

- preview and general revision call only their reviewed bounded RPC mappings;
- confirmation, weight, deletion, and history reads use only their reviewed bounded RPC mappings;
- ambiguous or false confirmation is rejected before repository access;
- stale, unpresented, expired, cross-user, and exactly-once confirmation remain enforced by the existing database pgTAP suites;
- MCP confirmation forwards only preview ID, confirmed revision, literal confirmation, and idempotency key; and
- the MCP server forwards the user bearer token to the bounded Supabase RPC path and never substitutes a service-role credential.

The executable preview/revision gate proves:

- `preview_food_log` creates a complete temporary revision and no permanent entry;
- preview totals are repository/server results, never client-trusted aggregates;
- revision requires the owned current preview, rejects expiry, creates the next immutable revision, recalculates totals, and returns the whole newly presented revision;
- ambiguous or false confirmation creates no entry;
- stale, unpresented, expired, or cross-user revision confirmation creates no entry;
- exact current-revision confirmation creates one entry transactionally;
- an identical idempotency retry returns the original entry/result;
- the same idempotency key with different arguments is rejected;
- update and deletion require explicit current-turn confirmation and remain owner-scoped; and
- the MCP server forwards the user bearer token to the bounded Supabase RPC path and never substitutes a service-role credential.

Database pgTAP remains the authoritative transactional/RLS evidence. MCP mock-repository tests must not be described as database or hosted end-to-end evidence.

## Health, logs, and redaction

The unauthenticated health response must disclose only coarse component status and must never query or return user data. Seed canaries into every sensitive input and assert that neither health output nor captured logs contain:

- access or refresh tokens;
- `Authorization` header values;
- API, publishable, secret, or service-role keys;
- authorization codes, PKCE verifiers, cookies, or full JWT claims;
- full meal descriptions, image evidence, ChatGPT transcripts, signed image URLs, or provider payloads; or
- body weight, targets, daily summaries, or complete history records.

Allowed diagnostics are a generated correlation ID, tool/action name, coarse error class, safe status, duration bucket or milliseconds, and an already-safe record identifier when operationally necessary. Do not log request headers or tool input objects wholesale.

## Response runbook

### Repeated authentication failures

1. Correlate by safe request ID, issuer class, client ID if already verified, action, and coarse failure reason.
2. Do not copy the bearer token or raw claims into a ticket, trace, chat, or log.
3. Confirm discovery metadata and JWKS availability separately from user traffic.
4. If a signing key rotated, purge only the verifier JWKS cache and respect the provider's key-overlap guidance.
5. Keep protected tools default-denied during recovery; do not bypass verification or substitute service role.

### Suspected token or secret leakage

1. Stop the affected deployment path and restrict log access.
2. Revoke the affected user grant/session and rotate any exposed server credential through its owner system.
3. Purge cached JWKS only when required for a signing-key incident; do not treat cache purge as token revocation.
4. Remove or quarantine leaked telemetry according to the approved retention process.
5. Re-run seeded-canary redaction tests before restoring traffic.

### Stale preview or duplicate confirmation spike

1. Preserve only safe correlation IDs, preview/entry IDs, revision numbers, action, and idempotency outcome.
2. Verify clients are presenting the exact current revision and reusing the same key only for an identical request.
3. Do not manually insert or repair permanent entries outside the transactional RPC.
4. Run the bounded summary consistency/repair workflow after the confirmation path is healthy.

### Unsupported custom-scope request

1. Reject or omit the unsupported scope; never silently reinterpret it as a database permission.
2. Keep general production writes disabled.
3. Point operators to ADR-0001 exit criteria.
4. Re-run live discovery, consent, reduced-scope, and revocation tests before changing the blocker status.

## Evidence boundaries

The local Phase 6 gate may establish source contracts, synthetic asymmetric-token verification, repository call ordering, safe error shapes, log redaction, and database RLS/transaction behavior. It cannot establish:

- a hosted Supabase OAuth authorization-code and PKCE exchange;
- real ChatGPT account linking or MCP Inspector compatibility;
- live revocation latency;
- deployed TLS, proxy, CORS, rate-limit, or cache behavior; or
- production logging/vendor retention.

These limitations must remain visible in `docs/TESTING.md`, `docs/PROJECT_STATUS.md`, and release documentation.

## Primary references

- [OpenAI Apps SDK authentication](https://developers.openai.com/apps-sdk/build/auth#triggering-authentication-ui)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP tool annotation schema](https://modelcontextprotocol.io/specification/2025-11-25/schema#toolannotations)
- [Supabase OAuth 2.1 flows and available scopes](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [ADR-0001: Supabase OAuth custom scopes](DECISIONS/0001-supabase-oauth-custom-scopes.md)
- [ADR-0002: exact preview confirmation](DECISIONS/0002-preview-revision-confirmation-gate.md)
