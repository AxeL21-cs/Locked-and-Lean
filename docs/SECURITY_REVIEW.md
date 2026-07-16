# Locked and Lean Phase 2 security review (historical snapshot)

This file records the Phase 2 review boundary as it existed on its review date.
It is not the current Phase 6 status. The protected MCP resource, asymmetric
per-request verifier, restricted client/action policy, and ChatGPT
preview/revision/exact-confirmation path are now implemented and deployed.
General granular authorization plus real post-expiry refresh/revocation and
user-owned end-to-end evidence remain open; see `docs/PROJECT_STATUS.md`.

Review date: 2026-07-13 (post-local Supabase verification)

Decision: **Not approved for production.** No critical or high implementation defect was identified in the final migration after local execution. Zero-state reset, 66/66 pgTAP assertions, database lint, and local advisors now support the Phase 2 database claims. Production remains blocked by two high implementation gaps outside the locally tested database: MCP token/granular authorization and account export/deletion lifecycle.

The live test cycle was security-relevant: its initial run exposed cross-user foreign-key error ordering and proved that schema-scoped default-privilege revocation did not override PostgreSQL's role-global function default. Both were fixed, and the final clean reset and full rerun passed. Residual verification is narrower but still material: true concurrency, forced rollback/response loss, adversarial Storage, hosted drift, and production OAuth/MCP behavior remain unproved.

## Scope and evidence

Reviewed in their final current form:

- root `AGENTS.md`
- `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/RLS_AND_SECURITY.md`, and ADR-0001/0002/0003
- `supabase/migrations/20260712133713_phase_2_core_schema.sql`
- `supabase/tests/database/phase_2_schema.test.sql` with 32 planned assertions
- `supabase/tests/database/phase_2_confirmation.test.sql` with 34 planned assertions
- this review, `THREAT_MODEL.md`, and `PRIVACY_DATA_FLOW.md`
- current Supabase OAuth flow, token-security/RLS, RLS, function-security, and Storage guidance
- current dependency audit and prohibited OpenAI API scan

Current command evidence:

- local Supabase zero-state `db reset` passed and applied the migration cleanly
- pgTAP passed 66/66 assertions: 32 schema/security and 34 confirmation/RLS/idempotency/history
- Supabase database lint passed with no schema errors
- Supabase local security/performance advisors passed with no issues
- migration source also passed static PostgreSQL SQL parsing
- `npm audit --omit=dev --json` reported 11 moderate, 0 high, and 0 critical vulnerabilities
- `npm run check:no-openai-api` passed

Not available as evidence:

- true concurrent confirmation, forced-rollback, or response-loss tests
- adversarial Storage operations, byte inspection, object-owner, signed-URL, or cleanup tests
- hosted-project RLS/grant/function ACL/default-privilege/exposed-schema drift inspection or hosted advisors
- deployed MCP protected-resource metadata or per-request JWT verification
- live OAuth issuer/audience/client/revocation tests
- account export/deletion, device-cache deletion, or retention/purge implementation

Severity describes the impact if the affected capability shipped. A **verification blocker** is not evidence of exploitation; it means a required security claim remains unproven.

## Overall control assessment

| Area                        | Final source control                                                                                                                                                    | Local execution evidence                                                                                    | Assessment                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| RLS and ownership           | all 17 public application tables enable RLS; own-row policies use `auth.uid()`; child relations use owner-composite foreign keys                                        | cross-user reads and cross-user confirmation denial passed                                                  | locally verified; hosted drift pending                            |
| table grants                | `anon` and `authenticated` rights are revoked, then SELECT is granted only to `authenticated`                                                                           | direct permanent-entry insert denial and function ACL assertions passed                                     | least privilege locally verified for current surface              |
| permanent food writes       | authenticated has no direct table mutation grant; confirmation accepts no `user_id` or total                                                                            | allowed confirmation, recomputation, one-entry result, and summary assertions passed                        | bounded local write path verified sequentially                    |
| client/action authorization | private policy table is empty by default; confirmation requires exact enabled `(client_id, 'confirm_food_log')`                                                         | approved, missing, and unknown-client assertions passed                                                     | prior SQL defect closed locally                                   |
| exact-revision gate         | owned preview is locked and checked for ready, unexpired, current, and matching presentation state                                                                      | cross-user, stale, and false-confirmation assertions passed                                                 | core local cases verified; expiry/presentation race cases pending |
| totals and hierarchy        | current items are summed; entry totals are trigger-maintained; parent links and canonical roles are constrained                                                         | recomputation, summary, snapshot, canonical-role, and parent-lineage assertions passed                      | locally verified                                                  |
| idempotency and audit       | request binding, owner-scoped key lock, unique preview link, identical-result reuse, and `created`/`reused` audit writes                                                | sequential new/reuse/conflict and audit assertions passed; no true concurrency/forced rollback              | locally verified sequentially; race proof pending                 |
| functions                   | public wrappers are invoker; definer helpers are private with empty `search_path`; schema-wide revokes plus a role-global future default revoke precede explicit grants | placement, search path, callable surface, internal-helper denial, and role-global default assertions passed | locally verified; hosted drift pending                            |
| OAuth/MCP runtime           | architecture requires signature, issuer, resource audience, time, subject, role, and `client_id` checks                                                                 | MCP runtime does not exist                                                                                  | high production blocker                                           |
| Storage                     | private bucket, 10 MiB, MIME allowlist, owner-prefixed path, scan preflight, SELECT/INSERT/UPDATE/DELETE policies                                                       | private bucket and policy catalog passed; no operation/byte/owner tests                                     | partial; upload release blocked                                   |
| privacy lifecycle           | database rows generally cascade from Auth                                                                                                                               | no export, deletion orchestration, Storage cleanup, cache cleanup, or retention job                         | high production blocker                                           |
| dependencies                | exact versions and lockfile                                                                                                                                             | 11 moderate advisories; no high/critical                                                                    | medium follow-up                                                  |
| prohibited OpenAI APIs      | repository scan passes                                                                                                                                                  | no deployed traffic review                                                                                  | static check passed                                               |

## Findings summary

| ID      | Severity | Type                                        | Status         | Finding                                                                                                                                                                         |
| ------- | -------- | ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-H01 | high     | authentication/authorization implementation | open           | The MCP resource server and its per-request token verifier are not implemented; database client/action checks cannot validate issuer, audience, signature, time, or revocation. |
| SEC-H03 | high     | privacy lifecycle implementation            | open           | Account export/deletion and Storage/cache cleanup are absent; Auth deletion alone can orphan meal images.                                                                       |
| SEC-M01 | medium   | file handling                               | open           | Storage SQL does not prove actual bytes, decode safety, exact dimensions, randomized names, quarantine, or `owner_id` binding.                                                  |
| SEC-M02 | medium   | retention/log privacy                       | open           | Preview, scan, image, idempotency, and audit retention/purge are not implemented.                                                                                               |
| SEC-M03 | medium   | prompt injection/size                       | open           | Some persisted untrusted text/JSON remains unbounded at the database and no MCP/rendering adversarial tests exist.                                                              |
| SEC-M04 | medium   | availability/tool abuse                     | open           | Authenticated summary rebuild permits repeated 367-date work without runtime throttling or measured-cost evidence.                                                              |
| SEC-M05 | medium   | dependency security                         | open           | The current production-tree audit reports 11 moderate Expo/build-chain advisories.                                                                                              |
| SEC-M06 | medium   | residual verification                       | open           | True confirmation concurrency/forced rollback, adversarial Storage, and hosted-project drift remain untested.                                                                   |
| SEC-L01 | low      | audit completeness                          | open           | Failed/denied/conflicting confirmation attempts cannot persist a database audit in the same transaction and need a safe runtime audit/metric design.                            |
| SEC-C01 | closed   | authorization                               | closed locally | Confirmation enforces an empty-by-default exact client/action allowlist; allow/deny assertions passed.                                                                          |
| SEC-C02 | closed   | privilege hardening                         | closed locally | Schema-wide revokes, a role-global future default revoke, and a four-signature allowlist passed ACL assertions.                                                                 |
| SEC-C03 | closed   | integrity                                   | closed locally | Canonical component roles and same-owner/same-entry parent linkage passed pgTAP.                                                                                                |
| SEC-C04 | closed   | audit                                       | closed locally | An identical completed retry writes a minimal `reused` audit; created/reused assertions passed.                                                                                 |
| SEC-C05 | closed   | local database verification                 | closed locally | Zero-state reset, 66/66 pgTAP, DB lint, and local advisors passed after live-found issues were fixed.                                                                           |

“Closed locally” means the control is present in source and passed the local Supabase suite; it does not mean hosted or production verification.

## High findings

### SEC-H01 - MCP token verification and granular production authorization are absent

**Evidence.** The current `mcp-server` contains domain/schema/provider modules but no deployed transport, protected-resource metadata, JWT verifier, or request authorization middleware. The architecture requires verification of signature through JWKS, exact issuer, canonical MCP resource audience, validity window, subject, role, and `client_id` on every request. The database now checks token-derived `client_id` against `private.oauth_client_action_policies`, but PostgreSQL receives claims only after the upstream Auth/Data API boundary and cannot prove that an independently exposed MCP endpoint validated its bearer token correctly.

Current Supabase OAuth documentation still exposes only `openid`, `email`, `profile`, and `phone`; those scopes control OIDC identity output, not food/weight database actions. Custom application scopes remain unsupported. The server-owned action map is valid defense in depth for controlled allowlisted development but is not granular user consent.

**Impact if shipped.** A resource server that decodes rather than cryptographically verifies a token, accepts the generic `authenticated` audience, accepts the wrong issuer, or ignores expiry/revocation can forward an unauthorized user context. Separately, presenting identity scopes as food-write consent would misstate the grant.

**Required remediation.** Implement protected-resource metadata and per-request asymmetric JWT verification; require exact issuer and canonical resource audience; validate `exp`, `nbf` when present, subject, role, and approved `client_id`; propagate the same user bearer token to Supabase; never substitute service role; and default-deny any client/action not approved. Preserve ADR-0001's production-write block until its granular-consent exit path is satisfied.

**Verification.** Test valid, malformed, unsigned, wrong-key, wrong-issuer, generic/wrong-audience, expired, not-yet-valid, revoked-session, missing-subject, wrong-role, missing-client, unknown-client, disabled-action, and read-only-client tokens. All denied cases must perform no tool work and no database mutation. MCP Inspector and live discovery/audience round trips must pass.

### SEC-H03 - Export/deletion lifecycle is absent and Storage can be orphaned

**Evidence.** User-owned database relations generally reference `auth.users` with `ON DELETE CASCADE`, but `storage.objects` is outside that cascade. There is no export service, recent-auth check, session-revocation step, deletion state/write freeze, private-object cleanup, local-cache cleanup, idempotent reconciliation, or approved retention/backups policy.

**Impact if shipped.** Deleting an Auth user can remove database rows while leaving sensitive meal images in Storage. A partial export can omit images, previews, targets, weight, or action history. Already-issued access tokens and device caches may outlive an incomplete deletion process.

**Required remediation.** Implement a coordinated, idempotent workflow for recent authentication, session revocation, write freeze, requester-only export, Storage-prefix and orphan cleanup, database deletion/anonymization under approved retention, Auth deletion, device-cache clearing, retry/reconciliation, and backup disclosure.

**Verification.** Populate every data type and several images for Users A and B. Prove A's export includes only A. Fail and retry every deletion stage, then inspect Auth, sessions, all tables, Storage, signed URLs, device caches, and retained audit/backups for eventual complete, cross-user-safe cleanup.

## Medium findings

### SEC-M01 - Storage policy does not validate exact uploaded bytes or object ownership

The bucket is private and restricts declared MIME type and size. Policies require an owner-prefixed path and approved, unexpired scan session with bounded stored dimensions; update has `USING` and `WITH CHECK`, and SELECT supports upsert. These are meaningful static controls.

They do not prove magic bytes, successful decoding, exact dimensions of the uploaded object, compression ratio, polyglot behavior, randomized filename generation, quarantine/inspection state, or `storage.objects.owner_id` binding. A trusted inspector must validate the exact object before use, and rejected/orphaned objects need cleanup.

Test valid files plus MIME spoofing, malformed/polyglot images, decompression bombs, dimension mismatch, oversize, overwrite/upsert, traversal-like names, cross-user paths, null/mismatched owner, expired preflight, signed-URL expiry, and cleanup. Image upload remains blocked until these pass.

### SEC-M02 - Sensitive temporary, retry, audit, and image data has no retention enforcement

Previews and scan sessions have `expires_at`, but no purge job deletes expired revisions/items or unlinked objects. Idempotency and OAuth audit tables have no expiry. Expiry prevents a later action; it is not deletion.

Approve a retention schedule and implement bounded, observable purge jobs for previews, scans, unused/rejected images, idempotency rows, audit rows, device caches, and backups. Test that expired records are removed, active records remain, retries are safe, failures reconcile, and logs expose only counts/safe identifiers.

### SEC-M03 - Untrusted text/JSON bounds and composition tests are incomplete

Many SQL numeric/string constraints exist and `original_description` is limited to 4,000 characters. `image_evidence_description`, several provider/provenance strings, and uncertainty JSON lack consistent byte/depth/item limits at the database boundary. The MCP formatter and Apps SDK renderer do not yet exist, so prompt-injection and output-encoding controls are unproven.

Keep all label/provider/user text in typed data fields, never instructions; bound bytes, depth, and items at transport and persistence; encode rendering; exclude health content from logs; and require the exact current revision for destructive action. Test English, Filipino, and Taglish instruction injection, markup/script, Unicode controls, deeply nested JSON, and maximum payloads.

### SEC-M04 - Summary rebuild needs abuse and cost controls

`public.rebuild_my_daily_summaries` derives `auth.uid()` and limits one call to 367 dates, so it cannot target another user. Every authenticated user can still invoke it repeatedly or in parallel. There is no runtime quota, cooldown, concurrency lock, or production-sized benchmark.

Prefer queued/incremental repair, add per-user/client rate and concurrency limits, measure realistic cost, and alert on abuse. Verify abusive calls fail boundedly without delaying normal confirmation or reads.

### SEC-M05 - Moderate dependency advisories remain

`npm audit --omit=dev --json` currently reports 11 moderate advisories and no high/critical findings. The chain includes `uuid` through `xcode` and Expo configuration/build packages. The suggested automated fix includes incompatible Expo changes and must not be applied blindly.

Track runtime/build reachability, upgrade through supported Expo tooling, constrain untrusted CI/build inputs, and rerun audit and Expo compatibility checks. Production policy should require no reachable critical/high issue and a documented owner/date for accepted moderate findings.

### SEC-M06 - Residual database and deployment verification remains

The former unexecuted-database high blocker is closed locally. Zero-state reset applied the migration, 66/66 pgTAP assertions passed, database lint reported no schema errors, and local advisors reported no issues. The first run caught two real defects: cross-user confirmation reached an owner-composite foreign key before the stable authorization response, and schema-scoped default revocation did not remove PostgreSQL's role-global `PUBLIC` execute default. The final migration performs the ownership check before idempotency insertion and applies a role-global default revoke; the complete rerun passed.

Residual risk is narrower and medium: the pgTAP flow is sequential, Storage assertions inspect bucket/policy catalog shape rather than adversarial object behavior, and no hosted project was compared with source. Run simultaneous same/different-key confirmation, forced trigger/summary rollback and response-loss recovery, byte/owner/signed-URL/cleanup Storage cases, and hosted ACL/RLS/exposed-schema/advisor drift checks.

## Low finding

### SEC-L01 - Denial and conflict audit needs a non-transactional safe boundary

The database writes successful `created` and `reused` audit rows. A function that inserts a denied/failed/conflict audit row and then raises will roll the row back with the failed transaction. The future MCP/runtime layer therefore needs a separate safe metric/audit path for authorization denials, token failures, and conflicting idempotency attempts without storing tokens, request bodies, or meal text. Audit failure must never make an unauthorized operation succeed.

## Closed findings

### SEC-C01 - Client/action default-deny enforcement

`private.oauth_client_action_policies` is unseeded and inaccessible to `PUBLIC`, `anon`, and `authenticated`. `private.confirm_food_log` reads `client_id` from `auth.jwt()`, requires an enabled exact `confirm_food_log` row before writing idempotency state, and denies missing/unknown clients. Local pgTAP passed the allowed, missing, and unknown-client cases.

This closes the earlier SQL implementation defect. It does not close runtime token validation or ADR-0001's granular-consent blocker.

### SEC-C02 - Function ACL and default-privilege hardening

The migration revokes execute on all functions in `public` and `private` from `PUBLIC`, `anon`, and `authenticated`, applies a role-global future `PUBLIC` execute revoke for the `postgres` migration owner, then grants four reviewed public/private bridge signatures. Definer helpers are private, use `search_path = ''`, schema-qualify objects, and re-derive `auth.uid()`. Local pgTAP passed the ACL, internal-helper denial, and role-global future-default probes.

The initial live probe proved that a schema-scoped default revoke was ineffective against PostgreSQL's role-global function default; that form was replaced rather than treated as passing. Authenticated `USAGE` on `private` and direct private bridge execute remain deliberate consequences of invoker wrappers calling private helpers. Hosted ACL/exposed-schema drift remains under SEC-M06.

### SEC-C03 - Component hierarchy integrity

Preview and entry items share the canonical role set. Root and child roles have complementary parent requirements. Composite foreign keys constrain a preview child to the same preview/revision/owner and a confirmed child to the same entry/owner. Confirmation deliberately retains preview item IDs as entry item IDs and preserves separate source-parent lineage. Local pgTAP passed role parity and both parent relationships.

### SEC-C04 - Reused confirmation audit

The completed-idempotency branch now inserts a minimal successful audit with `idempotency_outcome = 'reused'` while holding the key row lock, then returns the owned existing entry. Local pgTAP passed one `created` and one `reused` event.

### SEC-C05 - Local database execution gate

Zero-state reset applied the final migration cleanly. All 66 planned pgTAP assertions passed, database lint reported no schema errors, and local security/performance advisors reported no issues. This closes the former SEC-H02 local-execution blocker. SEC-M06 retains only evidence not covered by that sequential local suite.

## Required release-gate tests

1. Race identical and conflicting idempotency keys; simulate response loss, trigger/summary failure, timeout, deadlock, and forced rollback.
2. Validate MCP discovery and JWT signature, exact issuer/resource audience, time, subject, role, `client_id`, and revocation on every request.
3. Exercise valid and adversarial Storage bytes, paths, object owners, overwrites, signed URLs, quarantine, and cleanup.
4. Compare hosted RLS, grants, function ACL/defaults, exposed schemas, bucket state, and advisors with the passing local source.
5. Test export/deletion, session revocation, device-cache erasure, retention jobs, and backup/audit disposition.
6. Run prompt-injection, rendering, log-canary, rate-limit/load, and dependency checks.
7. Record exact results in `docs/PROJECT_STATUS.md`.

## Current Supabase guidance applied

- Enable RLS on every exposed-schema table and combine `TO authenticated` with ownership rather than treating the role as authorization.
- OAuth identity scopes do not control database actions; constrain OAuth access with token-derived `client_id` and RLS/application policy.
- Verify third-party resource audiences and use asymmetric signing/JWKS for distributed token validation.
- Prefer invoker functions. Keep unavoidable definer helpers out of exposed schemas, set a safe `search_path`, qualify objects, re-check identity, and revoke default `PUBLIC` execute.
- Private Storage access depends on `storage.objects` policies; declared MIME/type limits are not byte inspection, and service-created objects can have different ownership behavior.
- Service/secret keys bypass RLS and must never appear in public clients or ordinary user request paths.

Sources: [Supabase OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows), [OAuth token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Storage ownership](https://supabase.com/docs/guides/storage/security/ownership), and [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).
