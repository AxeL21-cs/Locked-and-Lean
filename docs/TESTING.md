# Locked and Lean testing

## Current evidence

- Phase 2 local database gate: passed after a clean reset, including 66/66 pgTAP assertions, database lint, and local security/performance advisors. See `docs/PROJECT_STATUS.md` for the recorded gate.
- Phase 3 static contract suite: passed 7/7 assertions on 2026-07-13 with `node --test tests/static/phase-3-contract-static.test.mjs`.
- Combined Phase 2/3 static run: passed 18/18 assertions on 2026-07-13.
- Phase 3 independent database QA: passed 37/37 assertions after a clean local reset on 2026-07-13.
- Full database directory: passed 143/143 assertions across four transactional files after the same reset. Supabase DB lint also passed with no schema errors.
- Latest application gate (Phase 6): format, Expo lint, TypeScript, and the prohibited model API scan passed; Jest passed 26/26 suites and 158/158 tests. The combined static contract run passed 43/43 tests, and the independently configured MCP package passed formatting, typecheck, 30/30 tests, and build.
- Hosted integration and true simultaneous-request evidence remain unavailable without user-owned hosted configuration. Sequential pgTAP retries verify request-bound idempotency semantics but are not a substitute for a concurrency race.

## Prerequisites

- Node.js `>=20.19.0`
- Dependencies installed from the lockfile with `npm ci`
- Docker Desktop with its Linux daemon running
- Supabase CLI and the committed `supabase/config.toml`

The Phase 3 QA session discovered Supabase CLI `2.109.1` and confirmed the supported path syntax with `npx supabase test db --help` before documenting commands.

## Static contract suites

Run the source-level suites from the repository root:

```powershell
node --test tests/static/phase-2-sql-static.test.mjs
node --test tests/static/phase-3-contract-static.test.mjs
node --test tests/static/phase-4-barcode-contract-static.test.mjs
node --test tests/static/phase-5-history-contract-static.test.mjs
```

The Phase 3 suite pins:

- exact bounded public RPC parameter names;
- server-derived `auth.uid()` identity and the absence of `p_user_id` or client aggregate parameters;
- matching mobile adapter RPC names and argument keys;
- preview-first manual logging with no direct permanent-table mutation;
- the first-party native confirmation branch without weakening ChatGPT OAuth authorization;
- the independent pgTAP plan count; and
- the prohibition on OpenAI model API integration in application artifacts.

The root `test:static` script runs every `tests/static/*.test.mjs` file. A successful `npm run test:static` therefore covers the Phase 2 through Phase 5 contract suites currently committed.

## Application gates

Run the mobile/component and repository checks separately:

```powershell
npm run format
npm run lint
npm run typecheck
npm test -- --runInBand
npm run check:no-openai-api
```

These checks do not execute PostgreSQL, RLS, grants, triggers, or transactions.

## Clean local database gate

The verified clean-database commands are:

```powershell
npx supabase start
npx supabase db reset --local
npx supabase test db --local supabase/tests/database/phase_2_schema.test.sql supabase/tests/database/phase_2_confirmation.test.sql
npx supabase test db --local supabase/tests/database/phase_3_qa.test.sql
npx supabase test db --local
npx supabase db lint --local
```

Run the two Phase 2 files together because the confirmation suite relies only on migrated state and creates its own transaction fixtures. Run the independent Phase 3 QA file alone once for focused diagnostics, then run the full directory to detect ordering or shared-state assumptions. Every SQL suite begins a distinct transaction and ends with `rollback`.

## Phase 3 independent database coverage

`phase_3_qa.test.sql` uses its own User A/User B fixtures and covers:

- adult-only personalized onboarding;
- proposal-only target calculation and explicit target activation;
- weight idempotency and the rule that a new weight cannot silently revise a confirmed target;
- explicit saved-food confirmation with unknown macros preserved;
- manual preview absence from the diary before exact-revision confirmation;
- identical confirmation retry without a duplicate entry;
- explicit soft deletion and daily-summary recalculation;
- unchanged ChatGPT OAuth authorization after adding first-party native confirmation; and
- cross-user denial for profiles, target history, weights, saved foods, entries, summaries, previews, and entry deletion.

Static inspection can prove that these assertions exist and that the plan count matches. Only successful pgTAP output after a clean reset is execution evidence.

## Required follow-up evidence

Before declaring Phase 3 complete:

1. Run the complete application gate after the mobile and backend agents finish their owned changes.
2. Independently race identical and conflicting confirmation/weight requests to prove behavior under simultaneous transactions.
3. Run Supabase security/performance advisors and compare live function ACL/RLS state with the migration.
4. Record the exact commands and results in `docs/PROJECT_STATUS.md`.

## Phase 4 barcode and Philippine product checks

Run the deterministic barcode domain suite with:

```powershell
npm test -- --runInBand src/domain/barcode
```

Current focused evidence on 2026-07-13: 3 suites and 31 tests passed, followed by a successful TypeScript check.

Coverage includes GTIN-8/UPC-A/UPC-E/EAN-13/GTIN-14 check digits and UPC-E expansion, formatting normalization, duplicate callback debounce/reset, exact-GTIN source ranking, Philippine-market preference, licensing/freshness/brand/market warnings, explicitly labeled mock products, Filipino serving clarification, unknown/ambiguous fallback, and current-presented-revision confirmation intent.

After the Phase 4 backend and scanner implementation stabilize, also run:

```powershell
node --test tests/static/phase-4-barcode-contract-static.test.mjs
npm run format
npm run lint
npm run typecheck
npm test -- --runInBand
npm run check:no-openai-api
npx supabase db reset --local
npx supabase test db --local
```

These exact implementation-backed checks are the threshold for reporting the local Phase 4 gate. Synthetic barcode products are test fixtures, not live provider integration evidence.

### Phase 4 execution evidence

Verified on 2026-07-13 after the backend and scanner implementations stabilized:

- clean local database reset applied all three migrations;
- focused Phase 4 pgTAP passed 47/47 assertions;
- full database directory passed 190/190 assertions across five files;
- Supabase DB lint returned no schema errors;
- Phase 4 static barcode contracts passed 9/9, and the combined Phase 2-4 static run passed 27/27;
- full Jest passed 16/16 suites and 114/114 tests; and
- format, Expo lint, TypeScript, and the prohibited model API scan passed.

This is local implementation evidence, not proof of live provider connectivity, licensed production product data, app-store camera behavior, or hosted end-to-end operation.

## Phase 5 history and timezone checks

Run the deterministic history domain suite with:

```powershell
npm test -- --runInBand src/domain/history
```

Current focused evidence on 2026-07-13: 3 suites and 17 tests passed, followed by a successful TypeScript check.

Coverage includes Asia/Manila midnight/month/year crossings, DST-independent local-date arithmetic, IANA 23/25-hour day behavior, Monday-first 42-cell month grids, week/day labels, non-color-only status vocabulary, immutable snapshots, deletion recalculation, preview-only copy intent, missing macros, weekly missing-record summaries, and sparse weight series.

After the Phase 5 backend and mobile implementations stabilize, also run:

```powershell
node --test tests/static/phase-5-history-contract-static.test.mjs
npm run format
npm run lint
npm run typecheck
npm test -- --runInBand
npm run check:no-openai-api
npx supabase db reset --local
npx supabase test db --local supabase/tests/database/phase_5_qa.test.sql
npx supabase test db --local
npx supabase db lint --local
```

Do not report hosted E2E, offline cache behavior, or physical-device chart accessibility from domain/static tests alone.

### Phase 5 execution evidence

Verified on 2026-07-13 after the history backend and mobile routes stabilized:

- focused history/mobile/adapter Jest passed 7/7 suites and 29/29 tests;
- independent Phase 5 pgTAP passed 32/32 assertions;
- an explicit zero-state database reset passed, followed by all seven pgTAP files passing 281/281 assertions;
- database lint found no errors, and local advisors reported no issues;
- the Phase 5 static history contract suite passed 7/7 tests;
- the combined static contract run passed 34/34 tests;
- full Jest passed 23/23 suites and 143/143 tests; and
- repository format, Expo lint, TypeScript, and the prohibited model API scan passed.

The independent SQL suite complements the backend suite with Manila New Year and UTC 16:00 rollover, provider-catalog drift versus immutable entry snapshots, cross-user history denial, preview-only copy/edit, confirmation retry idempotency, deletion/progress recalculation, and sparse weight gaps. These are local implementation checks, not hosted concurrency, offline-cache, or physical-device accessibility evidence.

## Phase 6 MCP and OAuth security checks

Run the focused MCP and consent suites with:

```powershell
npm --prefix mcp-server run check
npm test -- --runInBand src/features/oauth src/services/supabase/__tests__/adapter.oauth.test.ts
node --test tests/static/phase-6-mcp-security-static.test.mjs
```

The MCP test fixtures use locally generated asymmetric keys and impossible `.invalid` issuer, resource, client, and provider values. They are explicitly synthetic and contain no hosted token, user session, authorization code, or live nutrition-provider data.

Coverage includes:

- canonical Protected Resource Metadata with only supported standard scopes;
- HTTP `401` plus `WWW-Authenticate` for malformed authorization and Apps SDK `_meta["mcp/www_authenticate"]` for protected-tool authentication errors;
- mirrored per-tool `securitySchemes` and truthful read-only/destructive/idempotent/open-world annotations;
- asymmetric signature, exact issuer and single audience, `exp`, `nbf`, future `iat`, UUID subject, authenticated role, client ID, standard scope, and exact client/action default-deny;
- no repository call after authentication, validation, cross-user, or backend-contract denial;
- literal confirmation, exact revision and idempotency parameters without client user IDs or aggregate totals;
- anonymous coarse health status and seeded token/error redaction;
- hosted-only consent readiness, strict authorization IDs, fresh-user checks, HTTPS registered return matching, and unsupported custom-scope approval blocking; and
- absence of model API dependencies/imports or prohibited model API configuration.

### Phase 6 execution evidence

Verified locally on 2026-07-13 after MCP, OAuth consent, and root integration stabilized:

- focused Phase 6 adversarial MCP tests passed 14/14;
- the complete MCP package passed formatting, typecheck, 30/30 Node tests, and TypeScript build;
- focused Phase 6 static contracts passed 9/9, and the combined static run passed 43/43;
- full mobile Jest passed 26/26 suites and 158/158 tests;
- the root gate passed formatting, Expo lint, mobile TypeScript, Jest, all static suites, the independent MCP check/build, and the prohibited model API scan;
- all seven unchanged database pgTAP suites passed 281/281; and
- database lint returned no schema errors.

Supabase OAuth still does not support custom food/calorie/weight scopes. The consent UI therefore labels standard scopes as identity-only and blocks unsupported scopes. For restricted allowlisted testing, `preview_food_log` and general preview revision require exact client/action policies, return complete temporary snapshots with `permanent_write: false`, and cannot create a permanent entry. Canonical confirmation remains exact-revision, explicit, transactional, owner-scoped, and idempotent. General production MCP writes remain blocked under ADR-0001.

Local evidence does not prove a hosted authorization-code/PKCE exchange, real ChatGPT account linking, MCP Inspector interoperability, revocation latency, deployed TLS/proxy/rate-limit behavior, chunked-request body bounding, or production telemetry retention. See `docs/MCP_SECURITY_TESTING.md` for the adversarial matrix and response runbook.
