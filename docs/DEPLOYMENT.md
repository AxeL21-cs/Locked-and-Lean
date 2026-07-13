# Locked and Lean Deployment

Status: Planned. No development, staging, or production deployment is provisioned or implied by this document.

## Purpose

This runbook defines the intended promotion path for the Expo mobile application, Supabase project, and future remote MCP service. The current repository contains only a credentials-free CI sanity build. EAS builds, app-store submissions, Supabase promotion, hosted MCP validation, and production release remain blocked until their implementations and owner-managed environments exist.

## Environment model

Use separate development, staging, and production environments. Production data, signing credentials, OAuth clients, database projects, and service credentials must not be shared with non-production environments.

| Surface             | Development                                 | Staging                                         | Production                                           |
| ------------------- | ------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Expo application    | Local Expo or development build             | Internal-distribution EAS build                 | Store-signed EAS build                               |
| Supabase            | Separate local or cloud project             | Separate cloud project                          | Separate cloud project with backups and alerts       |
| Remote MCP service  | Local or isolated HTTPS endpoint            | Public staging endpoint and test OAuth client   | Public production endpoint and approved OAuth client |
| Nutrition providers | Labeled fixtures or development credentials | Staging credentials and controlled test records | Production credentials and reviewed provider terms   |

No environment may use production secrets in pull-request CI. CI must remain able to run against an untrusted contribution without repository or environment secrets.

## Configuration and secret boundaries

### Mobile-safe configuration

Only values intentionally safe for inclusion in a compiled application may use the `EXPO_PUBLIC_` prefix:

- `EXPO_PUBLIC_APP_NAME`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

A Supabase publishable key is not an ownership control. Every exposed table, view, function, and Storage object still requires tested RLS or an equivalent server-side boundary. Never place a service-role key, provider credential, signing secret, access token, or refresh token in an Expo variable, app config, source file, build log, or client bundle.

### Server-only configuration

The following are server-side values and must be stored in the secret manager for the environment that consumes them:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MCP_SERVER_BASE_URL`
- `MCP_RESOURCE_IDENTIFIER`
- `USDA_FDC_API_KEY`
- `OPEN_FOOD_FACTS_USER_AGENT`
- `APP_PUBLIC_URL`
- `OAUTH_CONSENT_URL`

The server runtime must validate required values at startup, log only variable names when configuration is missing, and never return secret values in errors, health endpoints, tool results, telemetry, or build output. The service-role key is reserved for narrowly reviewed operational work and must not be used on the normal mobile or MCP user request path.

Repository `.env` files are local-only. `.env.example` contains names and non-secret examples only. GitHub Actions secrets must be environment-scoped, least-privileged, and unavailable to pull requests from forks. A credentials-free validation job remains mandatory even after authenticated release jobs are added.

## Continuous integration

`.github/workflows/ci.yml` runs on Linux and Windows using the committed npm lockfile. It performs:

1. `npm ci --no-audit --no-fund`
2. Prettier verification
3. Expo ESLint verification
4. TypeScript checking
5. Jest tests
6. the prohibited model-API usage scan
7. public Expo configuration resolution
8. a credentials-free static web export

The web export is a build sanity check, not a deployment artifact and not evidence that native EAS builds or cloud services are configured. Keep branch protection aligned with the Linux and Windows jobs once the repository is connected to GitHub.

## Planned promotion sequence

### 1. Supabase

Blocked until Supabase migrations, seeds, RLS policies, Storage policies, database tests, and project configuration exist.

When implemented:

1. Create separate staging and production projects under owner-controlled organizations.
2. Configure asymmetric signing keys, allowed redirect URLs, approved OAuth clients, backups, log retention, and alerts.
3. Link the CLI to staging without committing project tokens or generated secrets.
4. Produce a migration diff from the versioned repository migrations and review destructive statements.
5. Apply migrations to a fresh disposable database, then staging.
6. Run schema, constraint, transactional/idempotency, privilege, and cross-user RLS tests.
7. Verify every exposed table has RLS enabled and every intended role has only the required grants.
8. Record migration identifiers and test evidence before production approval.
9. Apply the exact reviewed migration set to production, rerun production-safe smoke checks, and monitor failures.

Database rollback must use a reviewed forward corrective migration. Do not rewrite applied migration history or bypass RLS to recover a release.

### 2. Remote MCP service

Blocked until the server, authentication, health checks, and hosting target exist. Production ChatGPT writes are additionally blocked by the OAuth custom-application-scope compatibility decision recorded in the implementation plan.

When implemented:

1. Deploy an immutable staging artifact with a user-context Supabase connection path.
2. Verify HTTPS, protected-resource discovery, exact issuer/audience/resource checks, PKCE, expiry, approved `client_id`, and default-deny behavior.
3. Run MCP Inspector and contract tests for preview, revision, current-revision confirmation, idempotency, and reconnect behavior.
4. Verify health endpoints and logs disclose no tokens, user records, meal descriptions, images, or provider secrets.
5. Promote the same immutable artifact only after the production OAuth blocker is resolved and the production checklist is signed off.

Rollback means routing to the last verified immutable artifact and confirming schema compatibility. If compatibility is uncertain, disable affected writes and preserve read-only access rather than bypassing authorization or confirmation rules.

### 3. Expo mobile application

Blocked until EAS project ownership, app-store records, signing, native build profiles, privacy disclosures, and production endpoints are configured.

When implemented:

1. Inject only production mobile-safe configuration through the owner-managed EAS environment.
2. Run the complete CI gate from the exact release commit.
3. Produce internal iOS and Android builds and test install, cold start, sign-in, session expiry, offline/read-only behavior, preview revision, confirmation, and history.
4. Inspect the bundled public configuration and scan the built artifacts for forbidden server credentials.
5. Promote the same reviewed commit to store builds; do not rebuild from an unreviewed working tree.
6. Use staged store rollout with crash, auth, write-failure, and duplicate-confirmation monitoring.

Mobile rollback uses store rollout halt and the last approved binary. Server and database compatibility must support the last approved mobile version for the documented support window.

## Release evidence

Each release record must include the Git commit, lockfile checksum, CI run, native artifact identifiers, Supabase migration identifiers, MCP artifact identifier, configuration version, test results, security and privacy approval, approver, timestamp, and rollback owner. Never record secret values in release evidence.
