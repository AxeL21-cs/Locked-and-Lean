# Locked and Lean Project Status

## Current phase

Phase 6 - ChatGPT App and MCP (local scaffold complete; production gate blocked)

## Completed work

- Inspected the empty repository and the complete 46-page master PDF.
- Adapted the configurable product identity to Locked and Lean.
- Created repository instructions, implementation plan, and project status documentation.
- Verified current official Apps SDK and Supabase OAuth guidance.
- Completed the Phase 1 architecture, data flow, three ADRs, brand system, Expo 57 mobile foundation, CI, deployment checklist, README, local setup guide, and AI-estimation limitations.
- Wired the production brand mark into Expo launcher, adaptive, monochrome, splash, and web icon configuration.
- Implemented all five required tabs and four required Add routes as an explicitly labeled foundation/demo shell.
- Passed the complete Phase 1 automated and browser quality gate.
- Completed the canonical food domain, layered interpretation/provider/confirmation model, component corrections, immutable history snapshots, and Philippine localization/provider strategy.
- Added the Phase 2 Supabase schema, RLS, private Storage policies, revisioned previews, canonical component hierarchy, transactional confirmation, idempotency, summary rebuilds, action-client default deny, and database/RLS documentation.
- Restored the local Docker/Supabase environment, corrected three defects found only by live pgTAP, and passed the full Phase 2 gate.
- Completed Phase 3 authentication, encrypted native session persistence, adult-only onboarding, server-proposed and explicitly confirmed targets, manual preview-confirm logging, saved foods, Today history/mutations, and weight logging.
- Added transactional, idempotent, owner-scoped RPCs for profile, targets, food confirmation, saved foods, soft deletion, summary rebuilding, and body weight while preserving the default-deny ChatGPT OAuth path.
- Passed the complete Phase 3 automated, database, production-export, and mobile-browser quality gate.
- Completed Phase 4 barcode capture UX, camera permission/settings/manual fallbacks, authoritative GTIN normalization and debounce, server-owned lookup, multi-variant and serving selection, immutable preview revision, and exact confirmation wiring.
- Added deterministic Philippine product ranking and source/market/license/freshness/brand warnings; all bundled products are visibly synthetic, blocked-by-default test fixtures.
- Passed the complete Phase 4 mobile, domain, database, static-contract, production-export, and protected-route browser gate.
- Expanded CI with static contracts and a clean local Supabase migration/pgTAP/lint/advisor job.
- Completed Phase 5 Manila-safe month/week/day history, immutable entry snapshots, safe copy/edit/delete flows, and accessible calorie/macro/weight trends.
- Added server-owned Calendar/Progress aggregations that derive Manila dates from timestamps, preserve nullable macros and sparse weights, and atomically replace an edited source only after exact preview confirmation.
- Passed the complete Phase 5 app, domain, database, static-contract, and production-export gate.
- Added a separate pinned Streamable HTTP MCP server with protected-resource metadata, strict tool descriptors, OAuth challenges, asymmetric JWKS verification, exact client/action policy, reviewed Supabase RPC mappings, coarse health, and adversarial tests.
- Added a hosted-config-only OAuth consent route that preserves one validated authorization request through fresh sign-in, blocks unsupported scopes and unsafe redirects, and never represents identity scopes as tool authorization.
- Kept unavailable preview/revision mappings fail-closed as `backend_contract_unavailable`; no repository call or permanent write occurs.
- Passed the Phase 6 local mobile, MCP, security, static-contract, production-export, and live-process gate, while retaining the production blocker.

## Blocked work

- Hosted Supabase project credentials are absent; local Supabase is configured on development-only ports.
- Supabase OAuth custom application scopes are not currently supported; the brief's proposed `food:*`, `calories:*`, and `weight:*` token scopes cannot yet be production-enforced by Supabase.
- ChatGPT developer-mode connection, OAuth consent, hosted MCP validation, and full E2E require deployed endpoints and user-owned configuration.

## Test status

- `npm run check`: passed (Prettier, Expo lint with zero warnings, TypeScript, 26 Jest suites / 158 tests, 43 static contract checks, MCP package check, prohibited OpenAI model API scan).
- Expo public config resolution: passed.
- Credentials-free Expo web production export: passed (26 routes, including `/barcode-scan`).
- Browser verification at 390x844: passed for Today, Calendar, Add, Progress, and Profile; no error overlay or browser console errors; Add safe-inactive feedback verified.
- Brand validation: passed alpha/corner assertions, 24 px legibility, and contrast checks.
- PDF extraction/render inspection: passed for sampled requirement pages.
- Phase 2 root gate: passed (8 Jest suites / 68 tests plus 11 Node static SQL tests).
- Local Supabase zero-state reset: passed; migration applied cleanly.
- pgTAP: passed 66/66 assertions (32 schema/security and 34 confirmation/RLS/idempotency/history assertions).
- Phase 3 pgTAP: passed 143/143 assertions across four suites after a zero-state database reset.
- Phase 4 pgTAP: passed 190/190 assertions across five suites after a zero-state database reset; the new barcode suite passed 47/47.
- Phase 5 pgTAP: passed 281/281 assertions across seven suites after a zero-state database reset; backend Phase 5 passed 59/59 and independent QA passed 32/32.
- Supabase application-schema lint: passed for `public` and `private`; generic extension lint warnings are excluded from the project gate.
- Supabase local security/performance advisors: passed with no issues.
- Phase 3 browser verification at 390x844: sign-in and registration routes render correctly, auth navigation works, and no browser console errors were emitted.
- Phase 4 browser verification at 390x844: the scanner route remains protected, unauthenticated access returns to sign-in, and no browser console errors were emitted.
- Expo native config resolution: passed with camera permission only, barcode-only rationale, and Android audio recording disabled.
- Phase 5 focused history/mobile/adapter tests: passed 29/29; Calendar/Progress status and chart semantics are text-and-symbol accessible rather than color-only.
- MCP package gate: passed typecheck/build and 30/30 Node tests, including 14 adversarial token/runtime cases and live Streamable HTTP initialization.
- OAuth consent focused gate: passed 15/15 tests; credentials-free web export passed with 27 routes including `/oauth/consent`.
- MCP live-process gate: `/healthz` returned a coarse locked/degraded response, unconfigured protected-resource metadata returned 503, and protocol `2025-11-25` initialization returned 200.

## Security status

- No secrets or credentials detected.
- No OpenAI model API dependency exists.
- RLS and transactional confirmation are implemented and locally tested. Remote MCP token validation and hosted configuration remain Phase 6 work.
- `npm audit --omit=dev` reports 11 moderate findings from Expo's native `xcode -> uuid` toolchain. The offered automatic fix is a breaking Expo downgrade, so it is not applied; monitor the upstream Expo dependency update before production.

## Known limitations

- ChatGPT handoff, hosted OAuth/MCP, and app-store builds remain unimplemented or unconnected.
- Expo web development emits framework-level `pointerEvents` deprecation and multiple-renderer context warnings, but the browser gate found no application error or user-visible failure.
- Barcode lookup currently uses the server catalog snapshot; live nutrition providers and licensed Philippine datasets remain unconnected pending terms/licensing review.
- Physical iOS/Android camera capture and OS-settings round trips, hosted drift, and true concurrent idempotency remain unverified.
- MCP preview/revision tools are intentionally unavailable because no OAuth-compatible general preview RPC exists; today summary, recent foods, update, and copy MCP coverage remains incomplete.
- Hosted authorization-code/PKCE, real ChatGPT linking, MCP Inspector, revocation behavior, TLS/proxy/rate limits, chunked-body bounding, and production telemetry retention remain unverified.

## Next actions

1. Select and configure an authorization server that can issue enforceable granular food/calorie/weight permissions, or wait for Supabase custom application scopes.
2. Provide hosted Supabase, OAuth client, canonical MCP HTTPS resource, JWKS, and deployment configuration for real PKCE/ChatGPT/MCP Inspector verification.
3. Add OAuth-compatible preview/revision RPCs and the remaining master-required MCP tools without weakening exact revision confirmation.
4. Complete TLS/proxy/rate-limit/chunked-body, revocation, concurrency, physical-device, accessibility, offline, and telemetry hardening before production.
