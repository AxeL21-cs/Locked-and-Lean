# Locked and Lean Project Status

## Current phase

Phase 6 - ChatGPT App and MCP (local scaffold complete; OAuth production gate blocked)

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
- Deployed all four application migrations to the hosted Supabase project and verified local/remote migration alignment, application-schema lint, and hosted security/performance advisors.
- Configured the production Expo environment with the hosted Supabase URL and publishable client key only; no service-role credential or OpenAI model credential is present in the mobile build.
- Produced an Expo SDK 57 Android production APK (version 0.1.0, build 1) through the internal-distribution profile and validated the downloaded APK archive and Android manifest.
- Completed an Android-first visual redesign across authentication and all five primary tabs: unified system sans-serif typography, a readable five-level scale, real Material/SF symbols, 48dp-or-larger interactive controls, raised surfaces, clearer calorie/macro hierarchy, and the production brand mark on authentication.
- Prepared Android version 0.2.0 (build 2) as the installable redesign release.

## Blocked work

- Supabase OAuth custom application scopes are not currently supported; the brief's proposed `food:*`, `calories:*`, and `weight:*` token scopes cannot yet be production-enforced by Supabase.
- ChatGPT developer-mode connection, OAuth consent, hosted MCP validation, and full E2E require deployed MCP/OAuth endpoints and user-owned configuration.

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
- Hosted Supabase migration alignment: passed for all four application migrations; linked `public`/`private` lint and hosted security/performance advisors returned no issues.
- Android EAS production build: passed for version 0.1.0 (build 1), internal-distribution APK; downloaded artifact is 122,637,469 bytes, contains `AndroidManifest.xml`, and has SHA-256 `714DEE92EE90A5BFACF9416259BF4D48B64464D9BEC753EF11BC7E0C9D85C4D3`.
- Mobile redesign gate: `npm run check` passed (158 app tests, 43 static/security checks, and 30 MCP tests), Expo production web export passed for 27 routes, and the 390x844 visual preview rendered with no application errors.
- Requested mobile-design audit: production font sizes below 11 were removed and explicit interactive control sizes are at least 48dp. The third-party heuristic still reports nine non-interactive numeric properties (such as icon/image sizes and line widths) as touch-target findings; each reported source was manually classified rather than weakening the visual design to satisfy the regex.

## Security status

- No secrets or credentials detected.
- No OpenAI model API dependency exists.
- RLS and transactional confirmation are implemented, fully tested locally, and deployed to hosted Supabase. Hosted migration alignment, lint, and advisors passed; remote MCP token validation remains Phase 6 work.
- `npm audit --omit=dev` reports 11 moderate findings from Expo's native `xcode -> uuid` toolchain. The offered automatic fix is a breaking Expo downgrade, so it is not applied; monitor the upstream Expo dependency update before production.

## Known limitations

- ChatGPT handoff and hosted OAuth/MCP remain unimplemented or unconnected; the Android APK is for direct internal installation rather than an app-store release.
- Expo web development emits framework-level `pointerEvents` deprecation and multiple-renderer context warnings, but the browser gate found no application error or user-visible failure.
- Barcode lookup currently uses the server catalog snapshot; live nutrition providers and licensed Philippine datasets remain unconnected pending terms/licensing review.
- Physical iOS/Android camera capture and OS-settings round trips, full hosted pgTAP under a privileged test role, and true concurrent idempotency remain unverified.
- Physical Android verification at 200% system font scale, TalkBack traversal, and low-end-device frame profiling remain required for the redesigned interface.
- MCP preview/revision tools are intentionally unavailable because no OAuth-compatible general preview RPC exists; today summary, recent foods, update, and copy MCP coverage remains incomplete.
- Hosted authorization-code/PKCE, real ChatGPT linking, MCP Inspector, revocation behavior, TLS/proxy/rate limits, chunked-body bounding, and production telemetry retention remain unverified.

## Next actions

1. Select and configure an authorization server that can issue enforceable granular food/calorie/weight permissions, or wait for Supabase custom application scopes.
2. Provide an OAuth client, canonical MCP HTTPS resource, JWKS, and deployment configuration for real PKCE/ChatGPT/MCP Inspector verification.
3. Add OAuth-compatible preview/revision RPCs and the remaining master-required MCP tools without weakening exact revision confirmation.
4. Complete TLS/proxy/rate-limit/chunked-body, revocation, concurrency, physical-device, accessibility, offline, and telemetry hardening before production.
