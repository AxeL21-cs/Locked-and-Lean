# Locked and Lean RLS and Database Security

Status: Phase 5 database controls verified locally; hosted and runtime/provider security evidence is still required.

## Security boundary

Supabase RLS is the row-ownership boundary. UI filters, MCP tool selection, ChatGPT text, request metadata, and client-supplied IDs are never authorization.

The mobile app and MCP server must use a publishable key plus the signed-in user's bearer token. The normal request path must not substitute `service_role`. No app or backend component calls an OpenAI model API.

## Data API grants

The migration explicitly grants `authenticated` only `SELECT` on Phase 2 application tables. This is required for Supabase projects where new public tables are no longer exposed automatically. `anon` receives no application table access. Grants determine whether the Data API can reach an object; RLS separately determines which rows are visible.

There are no authenticated direct `INSERT`, `UPDATE`, or `DELETE` grants on permanent food history, idempotency, audit, target, weight, preview, saved-food, provider-serving, or summary tables. Phase 3/4 mutations are available only through the reviewed RPC signatures.

## Ownership policies

Every application table in `public` has RLS enabled.

- Direct user tables use `(select auth.uid()) = user_id`.
- Private saved foods are visible only to their owner; catalog foods with `user_id is null` are shared.
- Alias visibility is proven through its parent food product.
- Restaurant catalog tables are readable to authenticated users.
- Product serving options are readable only when the parent is shared or owned; provider/serving ingestion remains server-only.
- Preview revisions/items, entries/items, weights, summaries, idempotency rows, and audit rows are owner-only.
- Child tables repeat `user_id` and use owner-composite foreign keys so a child cannot be attached to another user's parent.

No policy authorizes from `user_metadata`, a request body `user_id`, or client-computed nutrition totals.

## OAuth client/action enforcement

Supabase currently does not provide the custom application scopes proposed by the product brief. Standard OIDC scopes do not authorize food writes. Under ADR-0001, the database therefore uses `private.oauth_client_action_policies` as an interim, server-owned, default-deny defense-in-depth policy.

For an OAuth confirmation, the privileged helper:

- requires a non-null authenticated subject;
- reads `client_id` from `auth.jwt()`, never from function arguments;
- requires an exact enabled `(client_id, 'confirm_food_log')` policy row;
- denies a missing client ID, unknown client, disabled row, or wrong action;
- still requires row ownership and the exact current preview revision.

The policy table ships empty. Enabling one action does not grant another. General production ChatGPT writes remain blocked until ADR-0001 exit criteria, live issuer/audience/time verification, revocation behavior, and least-privilege tests pass.

The reviewed mobile path is deliberately narrower: a normal authenticated Supabase token with no OAuth `client_id` may confirm only an owned preview whose source is `manual`, `barcode`, or `saved_food`. It cannot confirm `chatgpt`. Any token that carries `client_id` is treated as OAuth and must pass the exact action policy. Profile, target, saved-food, manual-preview, barcode lookup, barcode preview creation, and barcode revision are first-party-only. Weight and deletion allow first-party calls; OAuth calls require exact `record_weight` or `delete_food_entry` policy rows.

Phase 5 history reads use the same default-deny principle. First-party sessions without `client_id` may read their own Calendar, day history, weight trend, and progress summary. OAuth tokens require an exact enabled action row for `get_calendar_history`, `get_day_history`, `get_weight_trend`, or `get_progress_summary`; one read action does not imply another. Copy and edit preview commands are first-party-only.

## Function security

Privileged helpers are in the non-exposed `private` schema, use `SECURITY DEFINER` only where direct table writes require it, set `search_path = ''`, fully qualify database objects, re-derive `auth.uid()`, and re-check caller policy.

Public wrappers are `SECURITY INVOKER`. Because an invoker wrapper must call its private bridge, `authenticated` has `USAGE` on `private` and execute on exactly eighteen reviewed private bridge signatures: the Phase 4 set plus Calendar, day history, weight trend, progress summary, copy preview, and edit preview. Direct Data API exposure remains limited to `public`; GTIN/date validators, ranking/warning helpers, snapshot JSON helpers, replacement triggers, and the retained Phase 2 confirmation core are not granted.

Each additive migration repeats the blanket execute revocation after creating its functions, then grants only the eighteen reviewed public/private bridge pairs. The role-global default privilege revoke remains in force so future functions do not inherit `PUBLIC` execute. Deployment checks must inspect `pg_default_acl`, `pg_proc.proacl`, `prosecdef`, and `proconfig` to detect drift.

## Calendar/history boundary

Calendar and Progress do not trust a client timezone or stored legacy `local_date`. Food and weight instants are converted by PostgreSQL at the fixed `Asia/Manila` boundary. Future write helpers reject every other timezone. Date-range RPCs accept no `user_id`; derive `auth.uid()`; bound date span and result size; exclude soft-deleted entries; and read confirmed immutable item snapshots instead of refreshing provider data.

Copy and edit operations cannot directly insert permanent history. They create complete, presented previews with owner/source lineage. Copy clones the immutable server snapshot. Edit accepts bounded item-level values through the existing manual validator, never aggregate totals. Only exact explicit confirmation creates the replacement entry. A non-public trigger then locks and soft-deletes the still-active owner source in the same transaction; failure rolls back all effects. The owner-composite source foreign key prevents cross-user lineage even for privileged accidental writes.

## Barcode/provider boundary

Barcode text and provider records are untrusted observations, not authority. Lookup accepts only canonical GS1 lengths, verifies the check digit, compares equivalent codes as GTIN-14, fixes market context to `PH`, derives the scan owner from `auth.uid()`, and rejects OAuth clients from the first-party route. A scan session cannot be used by another user and expires after 30 minutes.

The provider registry is private with RLS enabled and no authenticated/anon table privileges. A provider cannot be marked live unless it is configured and has a recorded terms review. The only seeded provider is a development fixture marked non-live. Candidate responses expose integration status, terms-review time, retrieval time, market status, and warnings; missing or stale evidence is not silently upgraded to Philippine-market truth. Catalog and serving writes are granted only to the trusted `service_role`/migration context and that credential must never enter the client bundle.

Barcode preview RPCs accept IDs and serving count, never client nutrient values. They re-read the selected server observation, bind it to the owned scan, calculate all totals, and preserve warnings/provenance in the immutable preview item. Serving changes create a new complete revision under a row lock. Confirmation remains the sole permanent write and rejects any superseded revision.

## Confirmation and idempotency

Confirmation locks the owner-scoped idempotency row before deciding whether to create or reuse. A key is bound to operation, preview, revision, and explicit confirmation. Identical completed retries return the original entry and add a minimal `reused` audit in the same transaction; conflicting reuse fails. New confirmation recalculates totals and writes preview, entry, items, summary, idempotency, and audit atomically.

Audit rows contain subject ownership, client ID, action, outcome, object IDs, and idempotency outcome. They must not contain bearer tokens, headers, transcripts, or meal descriptions. Retention and abuse-rate controls remain to be approved and implemented.

Weight keys are unique per owner and bound to the timestamp, timezone, derived local date, and weight; conflicting reuse fails. Deletion is owner-scoped, requires explicit true, is soft/idempotent, and relies on the entry trigger to rebuild the affected daily summary transactionally. Saved foods are owner-private under the existing product RLS policy. Calories-only items retain nullable macros and an explicit completeness flag through preview, history, and summaries.

## Storage boundary

`meal-images` is private, limited to JPEG/PNG/WebP and 10 MiB. Object policies require an owner-prefixed path and scan-session relationship; upload/update require an approved, unexpired preflight with bounded dimensions. Upsert has SELECT and UPDATE paths in addition to INSERT.

These SQL policies do not prove magic bytes, successful decoding, compression ratio, exact-byte dimension inspection, or `storage.objects.owner_id` binding. A trusted quarantine/inspection workflow, randomized names, owner checks, signed-URL tests, rejected/orphan cleanup, and byte-level adversarial tests are required before image upload is production-ready.

## Explicit release blockers

- Hosted-project drift, real token issuer/audience/revocation, and runtime MCP authorization are unverified.
- True concurrency, forced rollback, and adversarial Storage byte/owner cases remain unverified.
- Account export/deletion and Storage cleanup are absent; deleting only `auth.users` can orphan meal images.
- General ChatGPT writes remain blocked by ADR-0001 until granular authorization exit criteria pass.
- Runtime limits for summary rebuilds and retention/purge jobs are not implemented.

These blockers must remain visible; mocks, static SQL inspection, and database cascades are not substitutes for production verification.

## Required deployment checks

1. Apply all migrations from an empty database.
2. Run all pgTAP suites and verify planned assertion counts (currently 281/281 locally across seven suites).
3. Inspect RLS flags, policies, table/sequence grants, function ACLs, owners, security mode, and search paths.
4. Test anon, User A, User B, approved client, disabled/read-only client, unknown client, missing client ID, wrong issuer/audience, expired/revoked token, and service role.
5. Race identical and conflicting idempotency keys and simulate response loss and transaction failures.
6. Exercise valid and adversarial Storage objects, paths, owner values, overwrites, signed URLs, and cleanup.
7. Run Supabase security/performance advisors and compare the hosted project with migration source.
8. Record exact results in `docs/PROJECT_STATUS.md`.
