# Locked and Lean Database

Status: Phase 5 Calendar/Progress and the goal-weight target planner are implemented and verified locally; the goal-planner migration is not yet claimed as deployed to the hosted project, and live nutrition-provider connectivity is not claimed.

## Source of truth

The tested Phase 2 baseline is `supabase/migrations/20260712133713_phase_2_core_schema.sql`. Phase 3 is the additive `supabase/migrations/20260712230402_phase_3_core_backend.sql`; Phase 4 adds `supabase/migrations/20260712234027_phase_4_barcode_backend.sql`; Phase 5 adds `supabase/migrations/20260713000921_phase_5_calendar_progress.sql`. Fast logging and offline receipts are added by `supabase/migrations/20260716091125_fast_logging_offline_sync.sql`. The goal-weight target planner is added by `supabase/migrations/20260717031644_goal_weight_target_planner.sql`. The additive migrations were created with pinned Supabase CLI 2.109.1. Migrations, not this document, are authoritative.

The database follows the product rule **interpret first, verify second, log third**. Preview tables are temporary workflow state. `food_entries` and `food_entry_items` are permanent history and cannot be inserted directly by `authenticated` or `anon`.

## Schemas

- `public`: Data API surface. Every application table has RLS enabled. Authenticated clients receive explicit `SELECT` grants only; permanent writes use reviewed RPCs.
- `private`: non-exposed policy tables and privileged helpers. `PUBLIC` has no schema access. Only the bridge functions required by reviewed public RPC wrappers are executable by `authenticated`.
- `auth`: Supabase identity source. User-owned records reference `auth.users(id)`.
- `storage`: optional private `meal-images` bucket and its object policies.

Function `EXECUTE` is revoked across the application schemas before the reviewed grants are applied. A role-global default privilege explicitly revokes `PUBLIC` execute for future functions owned by the Supabase `postgres` migration role. This default intentionally omits `IN SCHEMA`: PostgreSQL's built-in function execute grant is global, and a per-schema revoke cannot override it.

## Table groups

### User configuration and measurements

- `profiles`: locale, timezone, units, optional formula inputs, and onboarding state.
- `nutrition_targets`: versioned target calculations and assumptions. Only one open confirmed target is allowed per user.
- `weight_logs`: timestamped metric weight snapshots with owner-scoped idempotency.
- `daily_summaries`: derived per-user, per-local-date cache for consumed nutrients, active target, and latest daily weight.

Personalized targets are adult-only and informational, not medical advice. `propose_nutrition_target` snapshots the current and target weights, current and target BMI screening values, Mifflin-St Jeor `locked-and-lean-msj-goal-v2` inputs, fixed activity multiplier, user-reviewed weekly pace, balanced-macro assumptions, disclaimer version, and sex-specific 1,200/1,500 kcal safety floor. BMI is contextual screening information and is not an input to the calorie formula.

The server derives `lose`, `maintain`, or `gain` from current weight versus target weight; the client cannot select a contradictory direction. It returns the maintenance estimate, requested and actually applied pace, calorie adjustment, safety floor, and estimated goal date. If the calorie floor changes the requested pace, the stored and presented applied pace and timeline reflect the floor-constrained result. Unsupported automatic loss goals below a target BMI of 18.5 and cases where the safety floor would reverse the requested direction are rejected rather than mislabeled.

`get_goal_setup` returns only the authenticated first-party user's saved profile, latest weight, target weight, activity, reviewed pace, and active-target state so the goal form can reopen prefilled. Editing formula inputs invalidates any stale proposal. A new proposal remains inert until `confirm_nutrition_target(..., true)` activates that exact snapshot; confirmation is retry-safe for the same already-confirmed target. A later proposal defaults to a date after the current open target, so weight changes never silently replace the active target.

### Nutrition catalog

- `food_products`: shared catalog rows (`user_id is null`) and private saved-food rows.
- `food_product_servings`: server-owned, selectable package serving observations whose visibility follows the parent product.
- `food_aliases`: localized aliases whose visibility follows the referenced product.
- `restaurant_chains`, `restaurant_menu_items`, and `restaurant_meal_components`: Philippine-market restaurant catalog and meal composition data.

Catalog providers supply observations and provenance. Confirmed history never depends on a live catalog join for its nutrient values.

`private.nutrition_provider_registry` records whether a provider is a development fixture, configured, or disabled; whether it is live; Philippine-market support; ranking priority; and the provider-terms review time. The migration seeds only `server_catalog_fixture_v1`, explicitly marked non-live. No credential or network provider adapter is configured. Provider ingestion must run in a trusted server context; authenticated clients have no catalog write grant.

`save_food_for_reuse` creates only an owner-private `food_products` row, requires explicit confirmation, and fixes provenance to `user_manual_v1`. Calories-only label data keeps macro columns null and sets `macro_data_complete = false`; unknown macros are never represented as measured zero grams.

### Preview workflow

- `chatgpt_log_previews`: owner, source, state, current revision, presentation time, expiry, and eventual confirmation link.
- `food_log_preview_revisions`: immutable complete revisions containing meal/time context, presented totals, and evidence.
- `food_log_preview_items`: item-level nutrient, provenance, uncertainty, and parent-component data for a specific revision.
- `scan_sessions`: bounded barcode/image workflow state and trusted upload-preflight metadata.

A ready preview must point to the complete current revision. Confirmation requires that exact revision to have been presented and remain unexpired.

`create_manual_food_log_preview` accepts item-level nutrition, never an aggregate total. It validates 1-100 items, validates referenced shared/owned products, calculates totals, creates revision 1, and stamps the same presentation time on the ready preview and revision. It creates no diary entry.

### Barcode lookup and preview

`lookup_barcode_candidates(barcode, 'PH')` is a first-party, server-catalog lookup. It strips scanner whitespace/hyphens, validates the GS1 check digit, and canonicalizes GTIN-8, UPC-A, EAN-13, and GTIN-14 to an equivalent zero-padded GTIN-14. Catalog comparison uses the same representation and an expression index, so equivalent UPC/EAN forms match without rewriting historical provider rows.

The RPC creates only an owner-scoped 30-minute scan session and returns all selectable catalog candidates. Ranking is deterministic: owner-private saved observations first, then Philippine, unknown, and foreign market variants within the source tier, followed by configured provider priority and default serving. It never treats a `480` prefix alone as Philippine-market proof. Foreign and unknown candidates include explicit market warnings. Fixture, disabled, unconfigured, unreviewed, missing-retrieval-time, and stale observations include explicit source warnings and provider status metadata. Equal-tier variants remain selectable; ranking is not a claim that one formulation is authoritative.

An unknown barcode returns one explicit `unknown` row with `manual_entry_required = true`; it does not invent a product or create a preview/entry. Because no live adapter is connected, the lookup mode is honestly returned as `server_catalog_snapshot`.

`create_barcode_food_log_preview` accepts only the owner scan-session ID, server product/serving IDs, serving count, and meal context. It verifies the selected serving belongs to the scanned product, calculates nutrition from the server observation, copies provenance/market/source warnings into the item snapshot, and creates a complete presented revision 1. It accepts no item nutrition or aggregate total.

`revise_barcode_food_log_preview` locks an owned ready preview, requires the exact expected revision, and creates a complete immutable next revision for a corrected serving/count. Earlier presented revisions remain stored but cannot be confirmed once superseded. The existing transactional `confirm_food_log` path accepts `barcode` previews and continues to require explicit confirmation of the exact current revision plus a bounded idempotency key.

### Permanent history

- `food_entries`: confirmed diary header, Manila-aware local date, source preview, and server-maintained totals.
- `food_entry_items`: immutable-at-confirmation nutrient/provenance snapshots and component hierarchy.
- `mcp_idempotency_keys`: request binding and completed result for exactly-once confirmation.
- `oauth_action_audit`: minimal client/action/outcome records; no tokens, headers, transcripts, or full meal descriptions.

The canonical `component_role` values are:

`standalone`, `meal`, `rice`, `main_dish`, `side_dish`, `sauce`, `drink`, `topping`, `condiment`.

`meal` is a zero-nutrient container. `standalone` and `meal` are root roles; every other role must reference a parent. Confirmation retains preview item IDs as entry item IDs, so `parent_entry_item_id` is deterministic, while `source_preview_item_id` and `parent_source_preview_item_id` preserve immutable preview lineage.

## Confirmation transaction

`public.confirm_food_log(preview_id, confirmed_revision, confirmation, idempotency_key)` remains the only permanent food-write entry point.

In one transaction it:

1. derives the owner from `auth.uid()` and reads `client_id` from the verified JWT context;
2. requires an enabled exact `client_id`/`confirm_food_log` row for every OAuth token; a first-party token without `client_id` is accepted only for an owned `manual`, `barcode`, or `saved_food` preview, never `chatgpt`;
3. requires explicit `true`, a valid revision, and a bounded idempotency key;
4. locks the idempotency row and rejects conflicting key reuse;
5. on a completed identical retry, writes a minimal `reused` audit and returns the existing entry;
6. locks and verifies the owned ready preview, expiry, current revision, and presentation timestamp;
7. recomputes nutrient totals from the current preview items;
8. creates entry and item snapshots, rebuilds the affected daily summary, marks the preview confirmed, completes idempotency, and audits `created`;
9. commits all effects together or rolls them all back.

The RPC accepts no `user_id` and no client-calculated total.

## Phase 3 and Phase 4 write RPCs

All public functions are invoker wrappers around reviewed private bridges. They derive ownership from `auth.uid()`:

- `upsert_profile`: validates the adult formula profile and a real IANA timezone.
- `get_goal_setup`: pre-fills the first-party goal form from the owned profile, latest weight, and latest target snapshot without exposing cross-user data.
- `propose_nutrition_target` / `confirm_nutrition_target`: calculate, present, then explicitly activate a versioned target.
- `create_manual_food_log_preview`: creates only a complete, presented revision.
- `save_food_for_reuse`: creates an owner-private reusable product after explicit confirmation.
- `confirm_food_log`: performs the exact, transactional, idempotent diary write.
- `record_weight`: computes local date from the supplied instant and validated IANA timezone; identical owner-scoped keys safely reuse the row.
- `delete_food_entry`: requires explicit true, locks the owned row, soft-deletes it, and recalculates the summary in the same transaction.
- `lookup_barcode_candidates`: validates and ranks the server catalog, returning an explicit unknown/manual fallback when no product exists.
- `create_barcode_food_log_preview`: converts only a server-owned product/serving observation into presented revision 1.
- `revise_barcode_food_log_preview`: creates a new immutable serving revision from an exact expected barcode preview revision.

None accepts `user_id`; none accepts a diary or summary aggregate.

## Derived totals

Item statement triggers recalculate entry totals after item insert, update, or delete. Entry, weight, and target triggers rebuild affected daily summaries. `public.rebuild_my_daily_summaries(start_date, end_date)` derives the user from `auth.uid()` and limits a request to 367 dates. Runtime rate limiting and measured-cost validation remain release work.

## Phase 5 Calendar and Progress reads

Phase 5 fixes the diary date authority to `Asia/Manila`. `private.local_date_for_zone` retains its existing signature for API compatibility but rejects every other timezone. New food and weight writes therefore cannot select a caller-controlled local-date boundary. Read models independently derive local dates from `consumed_at`/`measured_at` at `Asia/Manila`, rather than trusting stored `local_date`, so legacy drift cannot move records across Calendar days. Matching expression indexes support active food-history and weight-range scans.

- `get_calendar_history(start_date, end_date)` returns every requested Manila date for ranges up to 62 days. It aggregates only active immutable entries, resolves the confirmed target effective on each date, selects the latest measured weight on that Manila date, and returns `has_entries` separately from zero-valued empty-day fields. A logged day containing any unknown macro returns null macro totals and `macro_data_complete = false`.
- `get_day_history(local_date)` returns up to 500 active confirmed entries in consumed-time order. Every entry includes its ordered immutable item snapshots as JSON, including hierarchy, serving, nutrients, completeness, provider/version/retrieval time, attribution, market, estimate/confidence, and uncertainty. The response exposes total count and truncation instead of silently hiding overflow.
- `get_weight_trend(start_date, end_date)` returns up to 2,000 measured points over at most 366 Manila dates. It does not interpolate missing days. Each point includes the actual previous owner point, weight change, and derived Manila day gap, including a previous point just before the requested range.
- `get_progress_summary(start_date, end_date)` aggregates active entries for at most 366 Manila dates. Calorie averages use logged days only. Macro averages use only complete-macro days and expose the number of eligible days. Weight change uses the first/latest measured points in range; targets resolve at the range end.

All four reads derive ownership from `auth.uid()`. First-party sessions may call them directly. Any token containing an OAuth `client_id` is default-denied unless the private client/action table contains an exact enabled row for that individual read action.

## Phase 5 copy, edit, and delete

Confirmed history remains immutable. `copy_food_entry_to_preview(entry_id, meal_type, consumed_at)` snapshots an owned active entry into a new `manual` preview with `history_intent = 'copy'`. It fixes the timezone to Manila, generates new preview-item IDs while preserving component hierarchy and provenance, and returns a complete self-contained preview including ordered items. Creating or rejecting the preview never changes the source.

`create_food_entry_edit_preview(entry_id, meal_type, consumed_at, original_description, items)` validates an owned active source, delegates item validation/server total calculation to the manual-preview path, and marks the result `history_intent = 'replace'`. It accepts item-level edits but no client aggregate. A replacement trigger runs only as the exact ready preview becomes confirmed: it locks and soft-deletes the still-active owned source in the same transaction as the new entry. If the source is missing/deleted or the lineage is invalid, confirmation rolls back. Identical confirmation retries return the completed entry without repeating replacement.

Both commands are first-party-only. The source relationship uses an owner-composite foreign key. Existing `delete_food_entry` still requires explicit true, soft-deletes under an owner lock, and transactionally recalculates derived summaries. Calendar/Progress reads independently exclude every soft-deleted entry.

## Fast logging and offline synchronization

- `saved_meals` stores owner-private immutable item snapshots copied only from confirmed active history. A stable client operation UUID makes creation idempotent. Favorites are a saved-meal preference, not a nutrition claim.
- `get_quick_log_suggestions` derives recent portions from the owner's last 90 days of confirmed active item snapshots. It returns the last observed serving, meal context, frequency, source entry/time, and an explicit confirmed-history provenance message.
- `create_saved_meal_preview` and `create_repeat_meal_preview` turn a saved snapshot or a selected prior Manila meal into a new complete presented preview. Reused items include `historical_portion_reuse` uncertainty. Historical rice weight or plate size is context to review, never an assertion that today's portion is identical.
  Offline clients keep the exact draft payload and stable confirmation idempotency key in their local queue. On reconnect they call `create_manual_food_log_preview`, compare the complete returned server revision to the locally presented revision, and only then call `confirm_food_log` with that stable key. A mismatch must return to preview instead of writing. UI states such as `waiting_to_sync`, `syncing`, and `failed` remain local client state; the server entry is authoritative only after canonical confirmation returns successfully.

## Data retention and deletion blocker

User-owned database rows generally cascade from `auth.users`, but Storage objects do not participate in those foreign keys. Account export/deletion and storage-prefix cleanup are **not implemented**. Production release must remain blocked until an idempotent workflow covers recent authentication, session revocation, write freeze, export, private object deletion, database cleanup, Auth deletion, device-cache clearing, retries, reconciliation, and approved backup/audit retention.

Do not present database cascades alone as account deletion.

## Verification status

The eleven pgTAP suites in `supabase/tests/database` pass 359/359 assertions after a zero-state local reset. The goal-planner suite adds 30 assertions for server-derived goal direction, BMI screening snapshots, safety-floor-adjusted pace and ETA, explicit and retry-safe confirmation, stale-proposal invalidation, first-party prefill, cross-user denial, and function ACLs. The Phase 5 assertions cover UTC+8 midnight boundaries, legacy stored-date drift, empty/incomplete days, snapshot provenance, sparse weights, progress averages, target resolution, copy preview-only behavior, replacement confirmation, soft-delete recalculation, cross-user isolation, OAuth default deny, RLS, and function ACL checks. Fast-logging adds saved-meal and historical-portion reuse, while the ChatGPT preview suite adds token-derived ownership/client checks, server-calculated estimates, immutable revision, stale/false confirmation denial, and idempotent exact confirmation. Local database lint reports no application-schema errors.

Hosted drift, true concurrent confirmation, forced rollback, adversarial Storage bytes/ownership, and production retention remain release work.

The previously sequence-sensitive Phase 3 effective-date fixture now derives its Manila date from the test clock, so the complete directory run passes as one invocation. Migration `20260716110100` is deployed to the hosted project; hosted deployment and advisor verification for `20260717031644_goal_weight_target_planner.sql` remain pending. Final user-owned ChatGPT confirmation and true concurrency evidence also remain outstanding.
