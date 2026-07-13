# ADR-0002: Preview revision as the permanent-write gate

- Status: Accepted
- Date: 2026-07-12

## Context

Food data can originate from ChatGPT interpretation, barcode providers, saved foods, or manual entry. Every source can be wrong or incomplete. Network retries and concurrent corrections can also duplicate or stale a write.

The product rule requires a complete current preview and explicit confirmation of that exact revision before permanent logging.

## Decision

All food sources use one state machine and one confirmation transaction.

- candidate creation validates input but has no diary side effects
- preview creation stores a complete revision 1 with totals, item details, provenance, uncertainty, meal, time, and expiry
- every correction recalculates the full preview, increments the revision, and clears prior confirmation intent
- confirmation supplies preview ID, exact shown revision, explicit `true`, and idempotency key
- the database transaction locks and rechecks owner, caller policy, state, expiry, and current revision
- the transaction recomputes totals, snapshots entry/items, updates the daily summary, marks the preview confirmed, and stores the result atomically
- the same key and same request return the original result; the same key with different input fails

No mobile insert, MCP shortcut, provider callback, fixture path, or administrator UX may bypass the transaction.

## Consequences

- barcode and manual entry have the same safety properties as ChatGPT
- stale UI and reordered tool calls fail safely
- response loss is recoverable without duplicate entries
- previews need expiry, revision, and idempotency storage
- offline food logging stops at draft until the server can produce a fresh preview

## Verification

Contract and database tests must cover preview-only behavior, correction, stale revision, expiry, ambiguous confirmation, cross-user access, duplicate retry, conflicting key reuse, transaction rollback, and matching historical snapshots.
