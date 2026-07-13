# Locked and Lean Implementation Plan

## Repository assessment

- Initial state: empty Git repository; no application, instructions, package manifests, credentials, or integrations were present.
- Source brief: a 46-page calorie and macro tracker build specification, adapted to the configurable product name **Locked and Lean**.
- Runtime: Windows PowerShell, Node/Python bundled, network available, no Supabase project credentials detected.

## Architecture invariants

1. ChatGPT interprets images/text and sends structured candidates to the remote MCP server.
2. Candidate data is untrusted until validated, matched, previewed, corrected if needed, and explicitly confirmed.
3. `preview_food_log` and revision tools cannot create permanent diary rows.
4. `confirm_food_log` verifies ownership and exact current revision, recalculates totals, and performs one transactional/idempotent write.
5. Supabase PostgreSQL + RLS is the authoritative ownership boundary.
6. Historical entries snapshot the exact nutrition/provenance used at confirmation time.
7. The mobile app never embeds a service-role key and no project component calls OpenAI model APIs.

## Current documentation compatibility decision

Supabase OAuth 2.1 currently supports standard OIDC scopes but not custom application scopes. The brief's proposed `calories:*`, `food:*`, and `weight:*` scopes cannot currently be issued honestly by Supabase. Phase 6 must therefore remain blocked from production until either Supabase supports custom scopes or an approved standards-compliant authorization design supplies equivalent enforceable grants. Development may scaffold tool-level policy names, but tests and docs must label them non-production and must not claim token scope enforcement that the issuer cannot provide.

## Sequential phases and gates

### Phase 1 - Planning and foundation

Deliver: repo assessment, agent configuration, architecture, brand direction, Expo scaffold, base navigation, environment template, initial CI.

Gate: install succeeds; format/lint/typecheck/tests pass; no prohibited OpenAI API usage; required docs/status current.

### Phase 2 - Domain and database

Deliver: canonical food model, Philippine aliases/units/ranking, migrations, RLS/storage policies, target formula, database/domain tests.

Gate: schema tests and cross-user/RLS tests pass; all exposed tables have RLS; no client totals or user IDs are trusted.

### Phase 3 - Core mobile application

Deliver: auth/onboarding, manual preview-confirm logging, saved foods, Today, edit/delete, weight logging.

Gate: component/domain tests pass; accessibility/offline/error states verified; only confirmed preview writes.

### Phase 4 - Barcode and Philippine products

Deliver: permission/scanner flow, lookup providers, Philippine ranking, serving/meal preview, unknown fallback.

Gate: debounce, source/market warnings, and confirmation tests pass.

### Phase 5 - Calendar and progress

Deliver: month/week/day history, editing/deletion/copy, progress charts, Asia/Manila date logic.

Gate: timezone and historical recalculation tests pass; status never relies on color alone.

### Phase 6 - ChatGPT App and MCP

Deliver: remote MCP transport, tools, protected-resource metadata, Supabase OAuth integration, preview/revision/confirmation contracts.

Gate: current OAuth blocker resolved; JWT signature/issuer/audience/expiry/authorization tests pass; MCP Inspector flow passes; exactly-once confirmation proven.

### Phase 7 - Food relationship integration

Deliver: structured candidates, dish disambiguation, combos, Taglish, uncertainty/correction flows.

Gate: Philippine fixtures and current-revision confirmation suite pass.

### Phase 8 - Hardening

Deliver: observability, rate limits, failure handling, security/accessibility/offline/E2E review, production checklist.

Gate: CI/E2E green, no critical/high security findings, deployment and limitation docs accurate.
