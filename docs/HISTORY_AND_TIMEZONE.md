# History, calendar, and timezone contracts

Status: deterministic local history contracts are implemented and tested. Backend history RPCs and mobile calendar/progress screens must use these semantics; hosted/device end-to-end verification remains separate.

## Timezone boundary

The saved IANA timezone is authoritative. The Philippine default is `Asia/Manila`.

- Instants are converted to a Manila local date through `Intl.DateTimeFormat` with the IANA timezone.
- Local calendar arithmetic parses `YYYY-MM-DD` and uses UTC date fields, so the device timezone cannot move a calendar cell.
- UTC timestamps are never truncated to obtain the Manila date.
- Day query bounds are start-inclusive and end-exclusive.
- The generic IANA day-bound helper supports 23-hour and 25-hour DST transition days even though modern Manila days remain 24 hours.

Examples:

- `2026-07-31T15:59:59.999Z` belongs to `2026-07-31` in Manila.
- `2026-07-31T16:00:00.000Z` belongs to `2026-08-01` in Manila.
- Manila day `2026-07-13` spans `[2026-07-12T16:00:00Z, 2026-07-13T16:00:00Z)`.

## Month, week, and day views

`buildMonthGrid` returns a stable 42-cell, Monday-first grid. Adjacent-month cells remain real dated cells with `inDisplayedMonth: false`; they are not placeholder dots. Each cell includes:

- exact local date;
- day number;
- weekday label;
- full accessibility label;
- displayed-month membership; and
- today state.

Weeks run Monday through Sunday and may cross month or year boundaries. Leap days are validated as real local dates.

## Status vocabulary

The calendar status contract is limited to:

- Within target (`✓`)
- Below target (`↓`)
- Above target (`↑`)
- Incomplete (`…`)
- No records (`—`)

Every status includes visible text, a unique symbol, an accessibility label, and a color token. Color is supplementary and never the only status signal. The vocabulary is neutral and does not label food or days as good, bad, clean, dirty, cheating, or failure.

The backend owns target/status calculation policy. The client/domain presentation contract does not invent an undocumented tolerance band.

## Immutable historical snapshots

Confirmed history is based on the nutrition and provenance stored on entry snapshots, not a live provider join. Immutable history copies preserve provider/version/retrieval/attribution and nullable macros. Later provider changes cannot rewrite old history.

Deletion excludes the soft-deleted entry and recalculates the daily snapshot from remaining active entry items. If any remaining active entry has an unknown macro, the corresponding daily and weekly macro remains `null`; it is never changed to zero.

## Copy and historical editing

Copy-to-today produces a new preview intent through `copy_food_entry_to_preview`. The command contains the owned entry ID, selected meal, and target instant. The target instant must resolve to the requested Manila local date.

Copying does not create a permanent entry. The new preview must be completely shown and its exact current revision explicitly confirmed. Historical editing follows the same replacement-preview rule; confirmation performs the transactional replacement and summary recalculation.

## Sparse progress series

Weight series include every requested local date. Missing dates have `weightKg: null`, `rollingAverageKg: null`, a visible “No weight” label, a gap marker shape, and a spoken “no weight recorded” label. Recorded points use a circle and a visible kilogram label. They are not interpolated. When a date has multiple measurements, the latest measurement is selected deterministically.

Rolling averages use recorded observations only and appear only on recorded points. Gap length remains explicit. Macro series similarly preserve missing/partial/complete states with gap/triangle/circle marker shapes and visible labels, and weekly summaries list missing record dates. Color is never the only chart signal.

## Test coverage

Focused Jest tests cover Manila midnight/month/year crossings, leap dates, Monday-first grids, IANA DST transitions, status text/symbol/accessibility contracts, missing macros, weekly summaries, sparse weights, rolling observations, immutable snapshots, deletion recalculation, and preview-only copy intent.
