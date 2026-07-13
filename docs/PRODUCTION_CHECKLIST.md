# Locked and Lean Production Checklist

Status: Blocked. This checklist is a release gate, not evidence of a deployment.

Every required item must be checked with linked evidence for the exact release commit. A waiver cannot override a security boundary, the preview-confirmation rule, RLS ownership, transactional/idempotent writes, or the current OAuth production blocker.

## Immediate blockers

- [ ] Supabase migrations, RLS policies, Storage policies, and database tests exist in version control.
- [ ] Separate owner-controlled staging and production Supabase projects exist.
- [ ] A production-capable remote MCP service and hosting target exist.
- [ ] The Supabase OAuth custom-application-scope blocker is resolved through an approved, standards-compliant authorization design.
- [ ] EAS ownership, build profiles, signing, store records, and privacy disclosures exist for iOS and Android.
- [ ] Production nutrition sources, credentials, attribution, market handling, and licensing have been reviewed.

Until every applicable blocker is resolved, do not describe the system as deployed, production-ready, connected, or live.

## Exact release gates

### Source and CI

- [ ] The release commit is reviewed, immutable, and tagged under the release policy.
- [ ] `package-lock.json` is committed and `npm ci --no-audit --no-fund` passes from a clean checkout.
- [ ] Prettier, Expo lint, TypeScript, Jest, and the unauthorized model-API scan pass on both Linux and Windows CI.
- [ ] `expo config --type public` succeeds without credentials and contains only intended public values.
- [ ] The credentials-free Expo web export succeeds from the release commit.
- [ ] Dependency, license, and known-vulnerability review has no unaccepted critical or high findings.
- [ ] Branch protection requires current CI checks and review; GitHub Actions permissions default to read-only.

### Application behavior

- [ ] Manual, barcode, saved-food, and ChatGPT-originated candidates all use the same preview-revision-confirmation boundary.
- [ ] No candidate, preview, correction, timeout retry, or offline draft creates a permanent diary row.
- [ ] A complete current preview shows items, portions, nutrition totals, provenance, confidence, assumptions, uncertainty, meal, time, and timezone context.
- [ ] Correction creates a new revision and stale revision confirmation fails without a write.
- [ ] Explicit confirmation of the exact current revision creates one entry and matching historical item snapshots.
- [ ] Same-key retries return the original result; reuse with different content fails; partial transaction failure creates no entry.
- [ ] Server-side code derives ownership from authenticated context and recalculates nutrition totals.
- [ ] Estimates and market mismatches remain visibly qualified; mocks and fixtures are visibly labeled.
- [ ] Accessibility, offline, empty, loading, partial-data, permission-denied, session-expired, and provider-failure states pass acceptance tests.
- [ ] `Asia/Manila` and other supported IANA timezone boundaries pass history and daily-summary tests.

### Supabase data and authorization

Status: blocked/planned until Supabase scaffolding exists.

- [ ] The exact reviewed migration set applies cleanly to a fresh database and staging before production.
- [ ] Every exposed table, view, function, and Storage path has reviewed privileges and an explicit ownership model.
- [ ] RLS is enabled on every exposed user-data table, with both read and write policies tested where applicable.
- [ ] Cross-user tests prove User A cannot select, insert, update, delete, invoke, or access storage belonging to User B.
- [ ] Direct-table food-entry writes are denied; the bounded confirmation transaction is the only permanent food-log path.
- [ ] Functions do not accept a trusted `user_id`; `SECURITY DEFINER` usage, if any, passes the documented hardening review.
- [ ] Constraints reject invalid quantities, nutrients, revisions, status transitions, and duplicate confirmation links.
- [ ] Daily-summary repair is auditable, scoped, and tested; failed summary updates roll back confirmation.
- [ ] Backups, point-in-time recovery, retention, restore rehearsal, alerts, and a forward-migration recovery procedure are verified.
- [ ] Production service-role access is inventoried, least-privileged in use, monitored, and absent from mobile and normal MCP paths.

### MCP and OAuth

- [ ] Protected-resource and authorization-server metadata validate over production HTTPS.
- [ ] Authorization code with PKCE S256 succeeds using registered production redirect URIs.
- [ ] Every request verifies signature, exact issuer, resource audience, expiry/not-before, subject, role, and approved OAuth client.
- [ ] Unknown clients, wrong audience, expired tokens, cross-user requests, ambiguous confirmation, and unsupported actions fail closed.
- [ ] Advertised scopes exactly match issuer capability; no identity scope is represented as application write authorization.
- [ ] Tool annotations and per-tool security metadata accurately represent read, write, and destructive impact.
- [ ] MCP Inspector and end-to-end tests pass preview, correction, exact-revision confirmation, idempotent retry, and reconnect behavior.
- [ ] Rate limits, request size limits, timeouts, safe error mapping, and abuse monitoring are enabled.
- [ ] Production ChatGPT writes remain disabled until the OAuth compatibility exit criteria in the implementation plan are met.

### Secrets and privacy

- [ ] Expo contains only public app name, Supabase URL, and publishable key configuration intended for distribution.
- [ ] Server secrets are environment-scoped in owner-controlled secret managers and unavailable to forked pull requests.
- [ ] Repository, Git history, CI logs, source maps, mobile artifacts, web bundles, tool results, and telemetry pass secret scanning.
- [ ] Access tokens, refresh tokens, authorization headers, provider keys, full meal descriptions, transcripts, health records, and images are excluded from logs.
- [ ] Secret rotation and revocation are rehearsed, with named owners and documented maximum response times.
- [ ] Data inventory, minimization, retention, deletion, account export, privacy notice, consent, and incident-response processes receive legal/privacy approval for the Philippines and store markets.

### Mobile release

- [ ] Bundle identifiers, app name, icon, splash screen, version, build numbers, permissions, and deep/universal links match approved records.
- [ ] Owner-managed EAS signing and store credentials are used; no signing material is committed or printed.
- [ ] Internal iOS and Android builds pass install, cold start, upgrade, auth, offline, confirmation, history, and session-expiry tests on supported devices.
- [ ] Built artifacts are inspected for server-only variables and unintended endpoints before submission.
- [ ] Store privacy declarations, nutrition/health-data disclosures, screenshots, support contacts, and deletion instructions are accurate.
- [ ] Staged rollout, compatibility window, minimum supported version, rollback binary, and on-call owner are recorded.

### Operations and approval

- [ ] Health and readiness checks reveal no secrets or user data and distinguish dependency failures.
- [ ] Dashboards and alerts cover authentication failures, denied clients, confirmation errors, duplicate attempts, transaction latency, provider failure, summary drift, and crash-free sessions.
- [ ] Correlation data is pseudonymous and sufficient to reconcile a write without storing meal content or credentials.
- [ ] Load, failure-injection, recovery, and rollback rehearsals pass at the approved production capacity.
- [ ] No unresolved critical or high security, privacy, data-integrity, accessibility, or reliability finding remains.
- [ ] Runbooks name the release commander, database owner, mobile owner, MCP owner, security contact, rollback authority, and incident channel.
- [ ] Release evidence records the Git commit, lockfile checksum, CI run, migrations, immutable artifacts, configuration version, tests, approvals, timestamp, and rollback target.
- [ ] Product, engineering, security/privacy, and operations approve the exact release candidate.

## Go/no-go rule

Release is **no-go** if any required checkbox is incomplete, evidence refers to a different commit or environment, a mandatory test is flaky or skipped, a critical/high finding is open, rollback is unverified, or production ChatGPT writes depend on unsupported OAuth application scopes. The release commander records the decision; silence is not approval.
