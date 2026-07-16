# Locked and Lean

Locked and Lean is a production-minded calorie, macro, body-weight, target, and
history tracker designed for users in the Philippines.

> **Current status: Phases 1-5 complete; Phase 6 MCP/OAuth endpoints are
> hosted but the account-owner connection remains production-blocked.** The mobile app and
> Supabase stack support authenticated, preview-confirm food logging, barcode
> review, history, targets, and weight/progress. Granular OAuth authorization,
> live providers, physical-device evidence, and production hardening are not complete.

The governing rule is **interpret first, verify second, log third**. A food
candidate must have a complete current preview, including uncertainty, and the
user must explicitly confirm that exact revision before a permanent write is
allowed.

## Capability status

| Status                | Current scope                                                                                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implemented**       | Auth/onboarding, targets, encrypted native sessions, manual and barcode preview-confirm logging, saved foods, Today mutations, weight logging, Manila-safe Calendar, accessible Progress trends, RLS, transactional/idempotent writes, hosted Expo consent and MCP endpoints, and a fail-closed OAuth client/action policy. |
| **Mocked / fixtures** | Barcode catalog records and security/provider test data are explicitly synthetic and blocked from production use. No fixture is represented as a live provider result.                                                                                                                                                      |
| **Blocked**           | Granular production MCP authorization, OAuth-compatible general preview/revision RPCs, licensed/live Philippine provider data, hosted ChatGPT/MCP Inspector E2E, and physical-device/release evidence.                                                                                                                      |
| **Production-ready**  | Not yet. Release requires every item in the [production checklist](docs/PRODUCTION_CHECKLIST.md) to pass with hosted and device evidence.                                                                                                                                                                                   |

## Run the app locally

Requirements: Node.js 20.19 or newer and npm.

```powershell
npm ci
npm --prefix mcp-server ci
npm start
```

From the Expo terminal, open Android, iOS, or web as supported by the local
machine. Equivalent scripts are:

```powershell
npm run android
npm run ios
npm run web
```

The sign-in and persistence flows need a configured local or hosted Supabase
project. See [Local development](docs/LOCAL_DEVELOPMENT.md) for the local stack,
environment variables, migrations, verification commands, and known blockers.

## Available screens

| Tab      | Current local behavior                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Today    | Server-owned daily summary and confirmed immutable meal snapshots with safe edit/copy/delete actions.       |
| Calendar | Manila-aware month/week/day history with accessible text-and-symbol status and exact selected-day entries.  |
| Add      | Manual preview-confirm logging, saved foods, and a permission-safe barcode scanner with explicit fallbacks. |
| Progress | Idempotent weight logging plus 14/30/60-day calorie, macro, and sparse weight trends.                       |
| Profile  | Authenticated profile, target review, logout, and explicit environment/limitation states.                   |

## Product configuration and brand

Feature UI reads the product name from `EXPO_PUBLIC_PRODUCT_NAME`, falling back
to `Locked and Lean`. Expo's native display name, slug, scheme, and bundle IDs
are configured separately in `app.json` and require a rebuild when changed.
Do not hardcode the product name in feature code.

Approved logo assets:

- launcher icon: `assets/brand/locked-and-lean-app-icon.png`
- transparent color mark: `assets/brand/locked-and-lean-mark.png`
- one-color marks: `assets/brand/locked-and-lean-mark-ink.png` and
  `assets/brand/locked-and-lean-mark-rice.png`

Use live configured text beside the mark; there is intentionally no raster
wordmark. Full rules are in the [brand guide](docs/BRAND.md).

## Safety and trust boundaries

- ChatGPT performs food/photo interpretation in the external ChatGPT workflow.
  The Expo app, backend, and MCP server **never call OpenAI model
  APIs** or contain an OpenAI API key.
- Supabase RLS, not UI filtering, is the implemented ownership boundary.
- A client-supplied user ID or nutrition total is never authoritative.
- Permanent writes must be transactional and idempotent.
- Estimates must expose uncertainty. A photo cannot reveal exact weight, oil,
  hidden ingredients, recipe, or restaurant formulation. See
  [AI estimation limitations](docs/AI_ESTIMATION_LIMITATIONS.md).
- Mocks and fixtures must remain visibly labeled and must not be represented as
  live integrations.

Architecture and data movement are documented in
[Architecture](docs/ARCHITECTURE.md), [Data flow](docs/DATA_FLOW.md), and the
[current project status](docs/PROJECT_STATUS.md).

## Verification commands

| Command               | Purpose                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`       | Run formatting, Expo lint/typecheck, 158 Jest tests, 43 static contracts, the MCP package gate, and the prohibited-API scan. |
| `npm run check:mcp`   | Typecheck, test, and build the isolated Node MCP package.                                                                    |
| `npm run db:reset`    | Rebuild local Supabase from all migrations.                                                                                  |
| `npm run test:db`     | Run all 281 pgTAP database/RLS assertions.                                                                                   |
| `npm run db:lint`     | Lint the application-owned `public` and `private` schemas.                                                                   |
| `npm run db:advisors` | Run local Supabase security/performance advisors.                                                                            |

## Current production blockers

- The hosted Supabase project, HTTPS MCP resource, JWKS verification, Expo web
  consent route, and Vercel deployment targets are configured. Real ChatGPT
  registration and the final account-owner OAuth settings are not yet verified.
- Supabase OAuth supports identity scopes but not custom application scopes
  such as `food:write`; general production ChatGPT writes remain blocked by
  [ADR-0001](docs/DECISIONS/0001-supabase-oauth-custom-scopes.md).
- General MCP preview/revision tools remain fail-closed until compatible
  server RPCs and granular authorization exist.
- ChatGPT linking, MCP Inspector, revocation/concurrency, physical-device,
  offline, accessibility, and full hosted E2E evidence are still required.

Do not work around these blockers with a service-role key in the app, UI-only
authorization, invented OAuth scopes, or model API calls from project code.
