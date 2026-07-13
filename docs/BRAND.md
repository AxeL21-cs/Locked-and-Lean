# Locked and Lean brand system

## Brand idea

Locked and Lean is disciplined but encouraging. The mark combines three ideas in one compact silhouette:

- a lock shackle for commitment and the product's `interpret -> verify -> log` discipline;
- a circular plate or bowl for food tracking; and
- a large `L` counterform for the configurable product name.

The calamansi-colored dot is a positive completion cue, not a keyhole or a body-weight target. Philippine context comes through the calamansi and rice palette and the food-first metaphor, without relying on flags, maps, or stereotypes. The identity must never imply punishment, restriction, shame, or a particular body shape.

## Approved assets

All production assets are 1024 x 1024 PNG files.

| Asset      | Exact repository path                        | Format            | Use                                                                                                                    |
| ---------- | -------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| App icon   | `assets/brand/locked-and-lean-app-icon.png`  | RGB, opaque       | Primary launcher icon. Warm-rice background is included. Let the platform apply its own mask; do not pre-round it.     |
| Color mark | `assets/brand/locked-and-lean-mark.png`      | RGBA, transparent | Splash screens, navigation, marketing, and a mark-plus-live-text lockup.                                               |
| Ink mark   | `assets/brand/locked-and-lean-mark-ink.png`  | RGBA, transparent | One-color use on warm rice, white, or other light backgrounds. The `L` and status dot become transparent counterforms. |
| Rice mark  | `assets/brand/locked-and-lean-mark-rice.png` | RGBA, transparent | One-color use on deep ink or other dark backgrounds. The `L` and status dot become transparent counterforms.           |

There is intentionally no raster wordmark. Render the configured product name as live text next to the mark so localization, accessibility, and product-name configuration remain intact. Do not bake `Locked and Lean` into feature assets.

## Palette

| Token     | Hex       | RGB           | Role                                                              |
| --------- | --------- | ------------- | ----------------------------------------------------------------- |
| Deep ink  | `#132019` | 19, 32, 25    | Primary mark, text, dark surfaces                                 |
| Warm rice | `#F5F0E6` | 245, 240, 230 | Primary background, reverse mark                                  |
| Calamansi | `#D9FF64` | 217, 255, 100 | Positive accent and the mark's completion dot                     |
| Tomato    | `#FF6B4A` | 255, 107, 74  | Sparing attention/correction accent; not part of the primary mark |

Measured WCAG contrast ratios:

- warm rice on deep ink: `14.81:1`;
- calamansi on deep ink: `14.77:1`; and
- tomato on deep ink: `5.97:1`.

Use deep ink for text on calamansi or tomato. Calamansi and tomato do not have enough contrast against warm rice for body text. The logo itself is not a substitute for a semantic success, warning, or error indicator.

## Lockups and wordmark

The preferred wordmark lockup is the color or one-color mark followed by the configured product name in the application's semibold sans-serif UI typeface.

- Use title case: `Locked and Lean` when the default configured name is active.
- Keep the wordmark as live text from the same product-name configuration used by the application.
- Set the cap height to about 42% of the mark height and vertically center the text against the circular body, not the shackle.
- Keep one status-dot diameter (`1x`) between the mark and the text.
- Do not abbreviate the public-facing name to `L&L` or redraw it inside the symbol.

## Clearspace, sizing, and placement

Define `1x` as the diameter of the calamansi dot in the color mark.

- Keep at least `1x` clearspace on every side of a standalone mark or lockup.
- Keep the full-color standalone mark at 24 px or larger in digital interfaces. At smaller sizes, use the ink or rice one-color mark and provide an accessible label.
- The supplied app icon places the mark inside a platform-safe square with 10% vertical and 20% horizontal outer breathing room. Do not crop or stretch it.
- Scale proportionally. Never rotate, skew, outline, add shadows, add gradients, or recolor individual pieces outside the approved palette.
- Do not place the color mark on photography or a background that reduces the silhouette's contrast. Use the one-color mark when the surface is visually busy.

## Accessibility and tone

- Give a standalone informational logo the accessible name `Locked and Lean` (or the configured product name). Mark it decorative when adjacent live text already supplies the name.
- Do not use the icon alone as an unlabeled interactive control.
- The calamansi dot is decorative brand language. Never make status depend on its color or presence alone.
- Pair nutrition estimates and progress states with plain-language labels. The brand voice is factual, calm, and encouraging; avoid `cheat`, `guilty`, `bad food`, `burn it off`, and body-shaming language.
- Do not combine the mark with weighing scales, measuring tapes, before/after bodies, lock keyholes, Philippine flags/maps, or fork-and-knife clip art.

## Asset validation

- `locked-and-lean-mark.png`: RGBA, transparent corners, alpha range 0-255, nontransparent bounds `(203, 102)-(821, 922)`.
- `locked-and-lean-app-icon.png`: RGB and fully opaque; all four corners are exact warm rice `#F5F0E6`.
- Both one-color marks: RGBA with transparent corners and the same nontransparent bounds as the color mark.
- A Lanczos downsample to 24 x 24 retained all three intended color regions: 115 deep-ink pixels, 443 warm-rice pixels, and 18 calamansi pixels under nearest-palette classification.
- Visual inspection confirmed a clean silhouette, no chroma fringe, no text, no watermark, and legibility at launcher and 24 px sizes.

The master is a high-resolution raster asset with vector-friendly geometry, not an editable vector file. Rebuild or trace it in a vector design tool before large-format physical production; do not auto-trace and silently treat the result as the canonical mark.
