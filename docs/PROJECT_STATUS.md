# Locked and Lean Project Status

## Current phase

Phase 6 - ChatGPT App and MCP (hosted endpoints deployed; OAuth production gate blocked)

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
- Initially kept unavailable preview/revision mappings fail-closed as `backend_contract_unavailable`; no repository call or permanent write could occur before the reviewed contract existed.
- Passed the Phase 6 local mobile, MCP, security, static-contract, production-export, and live-process gate, while retaining the production blocker.
- Deployed all four application migrations to the hosted Supabase project and verified local/remote migration alignment, application-schema lint, and hosted security/performance advisors.
- Configured the production Expo environment with the hosted Supabase URL and publishable client key only; no service-role credential or OpenAI model credential is present in the mobile build.
- Produced an Expo SDK 57 Android production APK (version 0.1.0, build 1) through the internal-distribution profile and validated the downloaded APK archive and Android manifest.
- Completed an Android-first visual redesign across authentication and all five primary tabs: unified system sans-serif typography, a readable five-level scale, real Material/SF symbols, 48dp-or-larger interactive controls, raised surfaces, clearer calorie/macro hierarchy, and the production brand mark on authentication.
- Prepared Android version 0.2.0 (build 2) as the installable redesign release.
- Deployed the Expo OAuth consent route to `locked-and-lean-web.vercel.app` and the Streamable HTTP MCP resource to `locked-and-lean-mcp.vercel.app`; both hosted endpoints return HTTP 200.
- Configured the hosted MCP runtime with the Supabase issuer, ES256 JWKS verification, exact canonical resource audience, publishable key, and a safe deny-by-default bootstrap client policy.
- Added and deployed a Supabase Custom Access Token Hook that changes `aud` only for OAuth clients with an explicitly enabled server-owned action; ordinary mobile sessions and unapproved clients retain the normal Supabase audience.
- Added fast-log Android flows for repeat breakfast, yesterday/recent entry review, Copy yesterday, saved foods, device favorites, and usual home/rice portions. Historical servings are dated suggestions and every shortcut still creates an exact preview requiring confirmation.
- Added owner-scoped SQLite caches for Today, Calendar/day history, and saved foods; offline manual confirmation now queues the exact on-device snapshot and stable idempotency key. Reconnect creates a server preview, deep-compares it, and confirms only an exact match; mismatches stop as `needs_review` and are never auto-logged.
- Added visible saved-copy/sync states, cached Today statistics and loading skeletons, reduced-motion-aware branded launch animation, Android draft back protection, haptics, and accessible 48dp quick actions.
- Added the owner-private `saved_meals` backend, favorite and usage metadata, repeat/copy preview RPCs, and provenance-bearing quick-log suggestions. The rejected one-call offline permanent-write design was removed because it could bypass exact server-preview review.
- Added read-only ChatGPT tools for today's calories and the seven-day protein average. Policy `403` denials no longer trigger futile reconnect prompts; invalid or expired tokens still issue the correct OAuth challenge.
- Prepared Android version 0.3.0 (build 3), which includes native SQLite, network-state, and haptic dependencies and therefore requires a new APK rather than an over-the-air JavaScript-only update.
- Deployed the fast-logging schema and its saved-meal source index to hosted Supabase, redeployed the SQLite-enabled web app and updated MCP server, and verified the canonical production aliases.
- Bound the one existing, actively consented ChatGPT OAuth client to read-only `get_calendar_history` access in both the private database policy and MCP runtime. Today-calorie and weekly-protein questions are enabled; food-writing permissions remain denied.
- Produced the Android 0.3.0 (versionCode 3) signed internal-distribution APK with the new SQLite/network/haptics native modules.
- Added OAuth-only ChatGPT preview creation and complete-snapshot revision RPCs. They derive owner/client from the token, require exact action rows, force estimate provenance and uncertainty, calculate totals in PostgreSQL, preserve immutable revisions, and cannot create permanent history.
- Replaced the MCP preview/revision kill-switch with the reviewed RPCs while preserving the separate exact-revision, literal-confirmation, transactional, and idempotent permanent-write gate.
- Deployed migration `20260716110100` and MCP deployment `dpl_4bby4KEpVMMhDRPuGE3ARtyRzVgs`; the existing consented ChatGPT client is restricted to calendar reads plus preview, revision, and exact confirmation.
- Traced repeated ChatGPT reconnects through live Auth and MCP request logs: PKCE authorization, token exchange, access-token hook, audience/resource binding, and refresh-token creation succeeded, but ChatGPT's first post-login MCP request received HTTP 406 because it advertised JSON without the SDK-required event-stream media type. Added a narrow compatible `Accept` normalization for JSON, event-stream, wildcard, or absent MCP response preferences while preserving 406 for unrelated media types.
- Deployed the transport compatibility fix as `dpl_Fa4LpJPi67qUJf12vGfcTVBat3ju` to the canonical MCP alias. A production JSON-only initialize now returns HTTP 200 with protocol `2025-11-25`; unauthenticated protected calls still return the OAuth challenge and `text/html` remains HTTP 406.
- A later reconnect exposed the next SDK boundary: successful fresh OAuth sessions were followed by HTTP 415 because Vercel had already parsed ChatGPT's valid JSON body while preserving a text content type. The adapter now relabels only absent, JSON, or text/plain platform-parsed JSON as `application/json`; unrelated content types and invalid JSON remain rejected.
- Deployed the tightened content-type compatibility fix as `dpl_4AgDe36YxX6RZofXnJDYjbrtnrPo`. The canonical production alias returns HTTP 200 for the reproduced text/plain JSON initialize and HTTP 415 for unrelated XML content.
- Reproduced the remaining reconnect failure through the connector itself. Supabase authorization-code/PKCE, token exchange, refresh-token issuance, and the access-token hook all succeeded, but the production MCP health surface reported `missing_client_action_policy`; this forced every protected request through the fail-closed verifier before repository access. Restored the exact reviewed client/action allowlist for calendar reads plus preview, revision, and exact confirmation.
- Corrected the host authorization handshake without broadening accepted input. The exact unauthenticated wildcard/octet-stream probe now receives HTTP 401 with `resource_metadata` and `scope="openid"` before media validation, while authenticated binary and unrelated XML remain HTTP 415. Missing credentials omit `error` fields; malformed or rejected credentials still use safe `invalid_token` challenges.
- Deployed the combined fix as `dpl_DzYYDXCnN5E3HVPdbtdAef1QmCbQ`. Production health now reports authentication and repository both configured, the canonical handshake probe returns the expected Bearer challenge instead of HTTP 415, and a real approved `get_calendar_history` invocation completed through the connected Locked and Lean plugin without a reconnect prompt.
- Integrated the exact user-supplied 1254px light and dark padlock/fork/leaf artwork, added system-driven light/dark theming, and refreshed the launcher, adaptive icon, favicon, and dual splash configuration. The in-app `BrandMark` switches artwork automatically while the Android launcher uses the dark navy/lime canonical icon.
- Completed the Android 0.4.0 (versionCode 4) performance-journal redesign across Today, Calendar, Add, Progress, Profile, auth, onboarding, barcode, saved foods, offline/sync, preview, OAuth, and error states. Semantic colors, 48dp targets, Android ripples, scalable type, TalkBack state labels, and non-color-only chart/status meanings were added without changing RLS, idempotency, offline conflict handling, or exact preview-confirm writes.

## Blocked work

- Supabase OAuth custom application scopes are not currently supported; the brief's proposed `food:*`, `calories:*`, and `weight:*` token scopes cannot yet be production-enforced by Supabase.
- A real post-expiry refresh-token test and full MCP Inspector E2E require a new interaction from the user-owned ChatGPT connector.

## Test status

- `npm run check`: passed on 2026-07-17 (Prettier, Expo lint with zero warnings, TypeScript, 29 Jest suites / 173 tests, 44 static contract checks, 43 MCP tests/build, and prohibited OpenAI model API scan).
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
- MCP package gate: passed typecheck/build and 31/31 Node tests, including platform-preparsed Vercel requests, 14 adversarial token/runtime cases, and live Streamable HTTP initialization.
- OAuth consent focused gate: passed 15/15 tests; credentials-free web export passed with 27 routes including `/oauth/consent`.
- MCP live-process gate: `/healthz` returned a coarse locked/degraded response, unconfigured protected-resource metadata returned 503, and protocol `2025-11-25` initialization returned 200.
- Hosted Supabase migration alignment: passed for all four application migrations; linked `public`/`private` lint and hosted security/performance advisors returned no issues.
- Android EAS production build: passed for version 0.1.0 (build 1), internal-distribution APK; downloaded artifact is 122,637,469 bytes, contains `AndroidManifest.xml`, and has SHA-256 `714DEE92EE90A5BFACF9416259BF4D48B64464D9BEC753EF11BC7E0C9D85C4D3`.
- Mobile redesign gate: `npm run check` passed (158 app tests, 43 static/security checks, and 30 MCP tests), Expo production web export passed for 27 routes, and the 390x844 visual preview rendered with no application errors.
- Requested mobile-design audit: production font sizes below 11 were removed and explicit interactive control sizes are at least 48dp. The third-party heuristic still reports nine non-interactive numeric properties (such as icon/image sizes and line widths) as touch-target findings; each reported source was manually classified rather than weakening the visual design to satisfy the regex.
- Hosted audience-hook verification passed transactionally: mobile and unapproved OAuth tokens retained `aud = authenticated`, an approved synthetic client received the exact MCP audience, `supabase_auth_admin` could execute the hook, and authenticated users could not.
- Hosted web consent, MCP health, protected-resource metadata, and protocol initialization checks passed. Local database reset/pgTAP was unavailable for this increment because Docker Desktop was not running; the hook's pgTAP suite remains committed for the next local database gate.
- Fast-logging database gate: clean local reset passed; the dedicated suite passed 21/21 after adding the hosted-advisor-recommended covering index, and the schema/calendar/fast-log regression subset passed 111/111. Database lint reported no application-schema errors. The full directory invocation still exposes a pre-existing sequence-sensitive Phase 3 effective-date fixture failure.
- Offline mobile contract: exact local/server preview match and mismatch-stop tests passed; the full mobile suite passed 160/160. The requested heuristic mobile audit still flags 12 mostly pre-existing/non-interactive numeric touch-size patterns and broad warnings that require manual classification.
- Expo production exports passed for Android and web. Web now includes the SQLite WASM worker and Vercel COEP/COOP headers; 28 static routes include `/oauth/consent` and `/repeat-entry`.
- Hosted Supabase migration alignment passed through `20260716101733`; `saved_meals` has RLS enabled and all five fast-log functions are present. The hosted performance advisor no longer reports an unindexed `saved_meals` foreign key.
- Production web verification passed with HTTP 200 and the required `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` headers. Production MCP health, protected-resource metadata, protocol initialization, and a 12-tool catalog check passed; the catalog includes the two new read-only insight tools.
- Android EAS production build `e5421785-c90d-45a1-8d48-a4ed272d39b1` finished for version 0.3.0 (build 3). The downloaded 129,913,082-byte APK contains `AndroidManifest.xml` and five DEX files; SHA-256 is `8F452B8A35954123D91979548AFEE1AB6C7B823EC7A04CAD2F904D7D03C03DEB`.
- ChatGPT preview database gate: the full clean local directory passed 329/329 pgTAP assertions across ten suites; application-schema lint returned no errors.
- Current repository gate: `npm run check` passed 160 mobile tests, 44 static/security contracts, 36 MCP tests plus typecheck/build, formatting/lint/typecheck, and the prohibited OpenAI model API scan.
- Post-reconnect focused MCP gate: format, typecheck, 38/38 Node tests, and production build passed, including the JSON-only post-OAuth reproduction and unrelated-media rejection.
- Post-content-type focused MCP gate: format, typecheck, 40/40 Node tests, and production build passed, including platform-parsed text JSON acceptance and unrelated content-type rejection.
- Post-authorization-handshake MCP gate: format, typecheck, 43/43 Node tests, and production build passed. The repository static/security suite passed 44/44, and the prohibited OpenAI model API scan passed.
- Hosted verification: migration history contains `20260716110100`; all four preview/revision wrappers and bridges have the expected security modes and grants; the canonical production MCP alias exposes 12 tools with the complete preview/revision schemas; and an unauthenticated preview returns the OAuth challenge before repository access.
- Hosted reconnect verification: coarse health changed from `locked` to `degraded` after the reviewed allowlist was restored; authentication and repository are both configured. The live wildcard/octet-stream probe returns HTTP 401 with the canonical protected-resource challenge, and the approved connector calendar read returned one owner-scoped Manila day without reauthentication.
- Android 0.4.0 configuration resolution passed with Expo SDK 57, automatic light/dark appearance, separate light/dark splash art, versionCode 4, predictive back gestures, the existing production package ID, and only the intended public Supabase environment values.
- Android and web production exports passed. The Android Hermes bundle includes both supplied brand assets; the web export produced all 28 static routes.
- Phone-size visual verification passed at 412x915 in light and OLED-dark modes: the correct artwork and canvas colors rendered, the sign-in and registration routes were meaningful and navigable, and agent-browser found no error overlay or browser errors.
- The mobile-design audit reported eight heuristic touch-size findings. Manual inspection confirmed they are text line heights, chart markers, skeleton bars, or visual icon containers inside 48-82dp controls; the actual interactive targets in those locations remain at least 48dp.

## Security status

- No secrets or credentials detected.
- No OpenAI model API dependency exists.
- RLS and transactional confirmation are implemented, fully tested locally, and deployed to hosted Supabase. Hosted migration alignment, audience-hook ACL/behavior, MCP verifier configuration, and unauthenticated challenge checks passed; a real ChatGPT preview/confirmation and post-expiry/revocation test remain Phase 6 evidence.
- The latest hosted security advisor reports leaked-password protection disabled, insufficient MFA options, and an informational no-policy notice for the intentionally private, service-role-only provider registry; these project settings were not silently changed by this deployment. The performance advisor reports informational covering-index suggestions on pre-existing foreign keys and expected unused indexes; the preview migration adds functions only and introduced no new relation or foreign key.
- `npm audit --omit=dev` reports 11 moderate findings from Expo's native `xcode -> uuid` toolchain. The offered automatic fix is a breaking Expo downgrade, so it is not applied; monitor the upstream Expo dependency update before production.

## Known limitations

- The updated MCP server is live, the current consented ChatGPT client is approved for read-only history, and exact policy denials no longer become futile OAuth challenges. Recreating the connector would register a new client ID and require one new explicit approval; post-expiry refresh behavior still needs a real ChatGPT test.
- Expo web development emits framework-level `pointerEvents` deprecation and multiple-renderer context warnings, but the browser gate found no application error or user-visible failure.
- Barcode lookup currently uses the server catalog snapshot; live nutrition providers and licensed Philippine datasets remain unconnected pending terms/licensing review.
- Physical iOS/Android camera capture and OS-settings round trips, full hosted pgTAP under a privileged test role, and true concurrent idempotency remain unverified.
- Physical Android verification at 200% system font scale, TalkBack traversal, and low-end-device frame profiling remain required for the redesigned interface.
- The existing allowlisted ChatGPT client can preview, revise, and exactly confirm a food log. General clients and update/copy/weight/delete writes remain blocked; the first real ChatGPT exact-confirmation and post-expiry/revocation evidence are still outstanding.
- Multi-item saved-meal composition is not yet exposed by the mobile adapter; the current UI supports saved foods and confirmed-entry copy previews. Recent quick logging uses yesterday plus locally confirmed usuals rather than a server-wide recent list.
- Hosted authorization-code/PKCE and real ChatGPT linking are now evidenced by successful Auth logs and an approved connector action. Post-expiry refresh/revocation behavior, MCP Inspector, TLS/proxy/rate limits, chunked-body bounding, and production telemetry retention remain unverified.

## Next actions

1. Run a real post-expiry refresh and MCP Inspector test through the currently approved ChatGPT connector; do not recreate it unless necessary.
2. Install the Android 0.4.0 (versionCode 4) production APK over the existing app and verify the light/dark splash, launcher mask, Today/Add flows, and offline reconnect on the physical phone.
3. Connect the new saved-meal/quick-suggestion RPCs to the mobile adapter for cloud favorites, multi-item saved meals, and a wider recent-food list.
4. Complete physical low-end Android, TalkBack, 200% font, offline/reconnect, concurrency, TLS/proxy/rate-limit, revocation, and telemetry verification before production.
