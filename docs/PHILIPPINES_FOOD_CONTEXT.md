# Philippine food context

Status: deterministic localization logic and clearly labeled fixtures are implemented. Live Philippine nutrition providers and official restaurant nutrition are not integrated.

## Defaults and boundaries

- Country: Philippines (`PH`)
- Timezone: `Asia/Manila`
- Currency: PHP
- Units: metric plus qualified local serving terms
- Interpretation inputs: English, Filipino, and Taglish

The Philippine layer normalizes wording and supplies matching context. It does not decide ownership, confirmation, or permanent writes. It never turns a local serving word into a universal weight, and it never treats a barcode prefix as proof of market.

## Deterministic language and alias handling

The localization package stores the original description beside the normalized description and interpretation language. Known brand names such as Chickenjoy and C2 keep their product spelling. Exact Taglish correction patterns yield typed directives such as quantity change, consumed fraction, component removal, or food replacement. Inputs outside the deterministic patterns remain intact for upstream interpretation rather than being guessed.

Dish aliases cover the initial brief list, including variant spellings such as `pakbet`, `pansit`, `adobong manok`, and `pan de sal`. Restaurant dictionaries cover the initial Philippine chain list and common shorthand such as McDo, Chickenjoy, Paa, Pecho, Chao Fan, and Whopper. An alias match does not imply that official nutrition exists.

## Serving conventions

Supported terms include gram, milliliter, cup, rice cup, tablespoon, teaspoon, piece, order, stick, sachet, pack, bottle, can, baso, mangkok, sandok, piraso, balot, and supot. Except for a direct gram or milliliter observation, a term needs a measurable amount supplied by a package label, restaurant source, user confirmation, or another traceable observation. The software stores that source description with the amount.

`One rice`, `one order`, `one cup`, and similar phrases therefore trigger clarification when no measurable serving is known. `Unli-rice` always requires an actual serving count before a preview can be considered complete.

## Source and market policy

The implemented order follows the master brief:

1. User-confirmed saved food
2. Exact Philippine barcode and package label
3. Manufacturer-published Philippine nutrition
4. Official Philippine restaurant nutrition
5. Legally usable Philippine composition data
6. Private user-confirmed product
7. Open Food Facts Philippine-market result
8. USDA generic food
9. Clearly marked comparable estimate
10. Manual correction

Market assessment may use package-label country, country-of-sale metadata, manufacturer/provider market metadata, and user confirmation. A barcode prefix is recorded as ignored evidence, never as proof. A foreign fallback displays: **Philippine formulation or serving size may differ.** Market versions must remain distinct, and confirmed history must snapshot the observation and version used at confirmation.

Fast-food source selection should prefer official Philippine nutrition, official Philippine menu labels, official restaurant responses, verified component data, user-provided labels, user-confirmed estimates, and only then a warned foreign-market fallback.

The Phase 4 packaged-product contract is documented in `docs/PHILIPPINES_PRODUCT_LOOKUP.md`. It adds GTIN check-digit validation, canonical duplicate-scan suppression, deterministic exact-product ranking, licensing/freshness/brand warnings, and explicit unknown or ambiguous fallbacks. It does not treat the bundled synthetic records as provider data.

## Honest fixtures and legal status

The editable combo fixture models separate main, rice, and gravy components with no nutrition values. It exists to test revision metadata, serving clarification, and sauce removal. It is not current menu data and must not be presented as a live restaurant integration.

No PhilFCT or DOST-FNRI records are bundled. Current access, licensing, attribution, and redistribution permission still require legal/source verification. The MCP provider contract is intentionally marked `blocked_pending_legal_review` until that work is completed.

Street-food handling retains uncertainty for piece size, batter or coating, frying-oil absorption, and sauce consumption. It does not invent precise weights or oil quantities.

## Confirmation language

Explicit phrases are classified only by exact normalized match: Yes, Correct, Tama, Tama yan, Oo, I-log mo, Log it, Save it, Okay na yan, log it, and Accurate yan. Siguro, Parang tama, Pwede na, Bahala na, Mga ganun, and Close enough are ambiguous and cannot authorize a permanent entry. A response containing a correction, such as `Tama pero walang gravy`, is not confirmation of the displayed revision.

## Test coverage

Jest tests cover the six exact Taglish examples, Filipino aliases, rice and unlimited-rice clarification, component-based mock combos, foreign-market warnings, street-food uncertainty, gravy removal, explicit versus ambiguous phrases, UTC instants that cross an `Asia/Manila` calendar boundary, GTIN/check-digit handling, barcode debounce, deterministic Philippine product ranking, provider warnings, fallback states, and current-preview barcode confirmation intent.
