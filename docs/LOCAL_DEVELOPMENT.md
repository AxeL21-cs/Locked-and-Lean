# Local development

Status: **Phases 1-5 and the fail-closed Phase 6 scaffold are implemented
locally. Production is not connected.** Local Supabase is real local
infrastructure; product/provider fixtures remain explicitly synthetic.

## Prerequisites

- Node.js `>=20.19.0` and npm
- Docker Desktop for local Supabase and pgTAP
- a supported device/emulator or web browser for Expo
- macOS/Xcode for iOS Simulator; Windows cannot launch it

## Install

```powershell
npm ci
npm --prefix mcp-server ci
```

Copy `.env.example` to an ignored `.env` and populate only mobile-safe public
configuration:

```dotenv
EXPO_PUBLIC_PRODUCT_NAME=Locked and Lean
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54821
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
```

Never place a service-role key or provider secret in an `EXPO_PUBLIC_*`
variable. Retrieve current local public values with `npx supabase status -o
env`; do not commit the output.

## Start the local stack

```powershell
npx supabase@2.109.1 start
npm run db:reset
npm start
```

The five tabs are Today, Calendar, Add, Progress, and Profile. Authentication,
targets, manual/barcode preview-confirm logging, saved foods, history, and
weight/progress use the local Supabase stack. Camera behavior still requires a
real supported device for complete evidence.

## MCP server

The MCP package is isolated from Expo:

```powershell
npm run check:mcp
npm --prefix mcp-server start
```

With no server configuration it intentionally starts locked/degraded on
`http://127.0.0.1:8787`:

- `GET /healthz` returns coarse blocker status without secrets.
- `GET /.well-known/oauth-protected-resource` returns 503 until a canonical
  HTTPS resource and authorization server are configured.
- `POST /mcp` exposes Streamable HTTP protocol behavior, but protected tools
  default-deny.

Do not set hosted mode merely to bypass this state. Follow
[OAuth](OAUTH.md), [MCP tools](MCP_TOOLS.md), and
[ChatGPT app setup](CHATGPT_APP_SETUP.md).

## Verification

```powershell
npm run check
npm run db:reset
npm run test:db
npm run db:lint
npm run db:advisors
npx expo export --platform web --output-dir dist-ci --clear
```

Current local evidence is recorded in [Project status](PROJECT_STATUS.md) and
[Testing](TESTING.md). The database gate applies every migration from zero and
runs RLS, cross-user, exact-revision, idempotency, history, barcode, and
timezone assertions.

## Environment boundaries

- Expo may receive the product name, Supabase URL, and publishable key only.
- MCP/server secrets and provider credentials stay server-side and out of
  logs, app config, and client bundles.
- Development, staging, and production use separate projects, OAuth clients,
  credentials, data, and evidence.
- The Expo app, database, and MCP server never call OpenAI model APIs.

## Production blockers

- Supabase custom application scopes are unavailable; identity scopes do not
  grant food/calorie/weight tool permissions.
- Hosted Supabase/OAuth/ChatGPT/MCP Inspector E2E is unverified.
- ChatGPT preview/revision RPCs are restricted to exact allowlisted OAuth
  client/action pairs; general client access and some master-required tools
  still fail closed.
- Live/licensed Philippine provider data, physical-device camera/accessibility,
  offline cache, concurrency/load, revocation, TLS/proxy/rate-limit,
  chunked-body, and telemetry evidence remain outstanding.

Do not work around these blockers with service-role credentials in the app,
UI-only authorization, invented scopes, or model API calls.
