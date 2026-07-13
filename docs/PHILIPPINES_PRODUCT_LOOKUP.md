# Philippine product lookup

Status: deterministic barcode and Philippine product-selection contracts are implemented with synthetic fixtures. Live product providers and licensed Philippine nutrition datasets are not integrated.

## Workflow boundary

The barcode flow follows this order:

1. Normalize and validate the scanned GTIN.
2. Suppress duplicate callbacks within the configured debounce window.
3. Ask the backend for exact catalog candidates; never infer country from a barcode prefix.
4. Rank only license-usable exact-GTIN candidates.
5. Require product selection when equally ranked candidates disagree.
6. Require a qualified serving and meal type.
7. Create and present a server-owned barcode preview.
8. If anything changes, create a new revision and present the complete revision again.
9. Send explicit confirmation only for the current presented revision.

The domain layer returns selection and confirmation intent. It never inserts a food entry or supplies a client-calculated aggregate to the confirmation RPC.

## GTIN policy

`src/domain/barcode/gtin.ts` supports GTIN-8, UPC-A, UPC-E, EAN-13, and GTIN-14. Formatting spaces and hyphens are removed, the GS1 modulo-10 check digit is verified, and valid identifiers are padded to a canonical 14-digit comparison value. When the scanner identifies UPC-E symbology, its compressed value is expanded and validated as the equivalent UPC-A lookup identity.

Unsupported lengths, non-numeric values, and invalid check digits lead to a rescan/manual fallback. A prefix such as `480` is not market evidence: it may identify where a number range was issued, not where the exact formulation is sold or manufactured.

## Deterministic ranking

Candidates must match the canonical GTIN and have a license status of private user data, licensed for use, or open licensed. Unknown licenses and sources blocked for legal review cannot be selected.

Usable candidates are ordered by:

1. The documented Philippine source priority, beginning with the user's confirmed saved food.
2. Philippine market evidence before unknown and foreign market variants for the same source level.
3. Exact normalized brand agreement when a scanned/label brand is available.
4. Fresh observations before unknown or stale observations.
5. Stable candidate ID as the deterministic final tie-breaker.

The stable ID tie-breaker makes output independent of provider response order. It does not silently resolve a substantive tie: candidates with the same decision rank remain ambiguous and require the user to select the matching label/version.

## Required evidence and warnings

Every candidate keeps provider ID/name, provider record ID, observation date, attribution, license status/name/URL, market status/evidence, serving basis, and macro completeness.

The lookup surfaces warnings for:

- foreign or unknown market;
- scanned-label brand mismatch;
- stale or missing observation date;
- unknown or blocked licensing;
- serving terms without a traceable gram or milliliter amount;
- incomplete macros, which remain `null` rather than becoming zero; and
- fixture-only data.

Foreign variants use the required warning: **Philippine formulation or serving size may differ.**

## Filipino serving terms

Package or provider records may use qualified terms such as bottle, can, sachet, piece, `baso`, `mangkok`, `sandok`, `piraso`, `balot`, or `supot`. These terms do not have universal weights. A current package label, provider record, or user measurement must supply a traceable gram/milliliter amount; otherwise the preview requires clarification.

## Unknown and ambiguous products

No usable exact match offers three explicit paths:

- enter the current package nutrition manually;
- check the signed-in user's saved foods; or
- share the nutrition label in ChatGPT, review the interpretation, and confirm only its current preview.

An ambiguous lookup shows the tied records and requires product/version selection. Neither unknown nor ambiguous lookup state can become a diary entry.

## Mock and provider status

`MOCK_PHILIPPINE_BARCODE_PRODUCTS` contains only synthetic QA records. Every record has `fixtureOnly: true`, a visible `MOCK FIXTURE ONLY` warning, a mock provider name, and synthetic attribution. Fixture candidates are excluded unless a test context explicitly enables them. These records are not current Philippine products, Open Food Facts records, manufacturer data, or production nutrition.

No PhilFCT/DOST-FNRI records are bundled. Any future dataset must pass licensing, attribution, redistribution, market-version, and freshness review before its candidates become usable.

## Acceptance coverage

Jest tests cover GTIN formats/check digits, formatting normalization, duplicate callback suppression/reset, deterministic source and Philippine-market ranking, blocked licensing, freshness/brand/market warnings, explicit fixture labels, Filipino serving clarification, unknown and ambiguous fallback, and exact current-preview confirmation intent.
