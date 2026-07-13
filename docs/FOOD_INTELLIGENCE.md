# Food Intelligence Domain

Status: deterministic domain model implemented; nutrition providers and ChatGPT/MCP transport are not integrated in this phase.

## Boundary

Locked and Lean follows **interpret first, verify second, log third**. ChatGPT may interpret a description or image into structured candidates, but neither an interpretation nor a provider match is a diary entry. This package does not call a model or a nutrition provider and does not perform a permanent write.

The model keeps three layers separate:

1. `interpretation` records what ChatGPT proposed, its evidence, alternatives, confidence, and uncertainty.
2. `providerMatches` records what each nutrition source matched, including its nutrition basis, market, confidence, warnings, and provenance.
3. `resolved` is the exact value shown in the current preview. A confirmed history snapshot copies this into a separate `confirmed` field only after the caller supplies the exact current revision.

No field from one layer overwrites or masquerades as another layer.

## Canonical relationships

The Zod schemas distinguish food concepts, packaged products, restaurant menu items, restaurant meal components, homemade dishes, generic ingredients, serving definitions, observed image items, user-described items, provider matches, and user corrections. Concepts carry aliases and preparation styles. Products carry barcode, market, package nutrition, and serving definitions. Restaurant combos expose editable components rather than an opaque total.

Aliases can be local or English names, Taglish phrases, misspellings, brand shorthand, or restaurant shorthand. Locale resolution and Philippine source ranking are owned by the Philippine food-data workstream; this domain only provides the stable contract.

## Quantity and totals

Every resolved value carries a quantity/unit and a nutrition basis with the same unit. Totals scale deterministically from that basis and round to two decimal places. Mismatched units fail instead of guessing a conversion.

When a preview item has known components, its total is the sum of active components. Any aggregate restaurant-menu nutrition on the parent is ignored, preventing double counting and preserving component editability. Removing or resizing a component recalculates the result. An unlimited-rice offer is not a quantity: the caller must provide a positive serving count before validation succeeds.

## Revisions and corrections

Corrections target stable item and component IDs. Supported changes are item resize/removal and component resize/removal/replacement. Every accepted correction:

- verifies that the supplied revision equals the current draft revision;
- applies only to the named target;
- appends immutable correction evidence; and
- returns a complete next preview with the revision incremented by one.

Stale, confirmed, or expired previews fail in pure domain logic. This is a defense-in-depth rule; the database transaction must independently lock and verify preview ownership, expiry, status, and revision.

## Confidence, uncertainty, and provenance

Overall confidence is the worst applicable confidence across the active ChatGPT interpretation, selected provider match, resolved values, and uncertainty statements. Active image uncertainty and selected-provider uncertainty are deduplicated and propagated to the confirmation snapshot. Removed items/components no longer affect current totals or current uncertainty.

Uncertainty categories include portion size, food identity, brand, market variant, cooking oil, sauce quantity, hidden ingredients, preparation method, and nutrition source. Exact-looking values must not be invented for unknown oil, sauce, ingredient, restaurant formulation, or portion weight.

Each selected nutrition value carries human-readable provenance: source, record/version when known, observation time, market, serving description, attribution, and whether it is an estimate.

## Historical snapshots

Confirmation requires the exact current revision and returns a recursively frozen deep copy containing:

- the original interpretation;
- the exact confirmed values and nutrition basis;
- component states;
- totals;
- confidence and uncertainty;
- provenance; and
- correction history.

Provider candidates are deliberately omitted from confirmed history. Later mutations or provider refreshes cannot change the snapshot. Persistence, ownership, idempotency, and transactional diary writes remain backend responsibilities.
