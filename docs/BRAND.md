# Locked and Lean brand system

## Brand idea

The current mark combines a padlock, fork, and leaf. It communicates disciplined tracking, food-first logging, and sustainable progress without using body imagery or shame-based fitness language.

The product name remains configurable. Render `PRODUCT.name` as live text beside the mark; do not bake the name into feature artwork.

## Approved 2026 assets

The two approved masters are exact copies of the user-supplied artwork. Both are 1254 x 1254, RGB, fully opaque PNG files.

| Asset            | Repository path                                | Intended use                                                                  |
| ---------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Light appearance | `assets/brand/locked-and-lean-brand-light.png` | Light UI, light splash artwork, and light-background brand lockups            |
| Dark appearance  | `assets/brand/locked-and-lean-brand-dark.png`  | Dark UI, Android launcher/adaptive icon, favicon, and dark-background lockups |

The supplied files contain black corner pixels rather than transparency. `BrandMark` therefore clips them inside a proportional rounded square without changing the source files. Do not use either file as a transparent overlay.

## Theme behavior

- The application follows the Android system light/dark preference through `userInterfaceStyle: automatic` and `AppThemeProvider`.
- `BrandMark` automatically selects the light or dark source artwork.
- Expo splash configuration declares separate light and dark images.
- Android launchers do not switch a conventional icon when the in-app color scheme changes. The dark navy/lime artwork is the canonical launcher icon; both variants remain available inside the app.
- A Profile appearance row truthfully reports the current system mode. There is no fake in-app theme toggle.

## Interface palette

The refreshed interface uses semantic roles rather than scattered literal colors.

| Role              | Light     | Dark      | Purpose                                       |
| ----------------- | --------- | --------- | --------------------------------------------- |
| Background        | `#F5F7FA` | `#000000` | Quiet light canvas and OLED-black dark canvas |
| Primary text      | `#07182F` | `#F2F6FA` | High-contrast headings and body copy          |
| Brand accent      | `#9DDD16` | `#A7E51D` | Progress, confirmation, and primary actions   |
| Strong brand text | `#3F6200` | `#B6EF3D` | Accessible accent text                        |

Measured contrast includes light primary text/background at `16.57:1`, light muted text/background at `5.79:1`, dark primary text/background at `19.33:1`, and dark muted text/background at `9.54:1`.

Lime is an accent, not a universal status color. Pair progress, sync, warning, and error states with text or symbols so meaning is never color-only.

## Usage rules

- Keep the artwork proportional; never stretch, rotate, trace, or recolor it.
- Use the shared `BrandMark` component instead of importing raster artwork directly into feature screens.
- Mark a logo decorative when adjacent live text already supplies the product name. Otherwise expose the configured name as its accessibility label.
- Keep interactive controls at least 48dp and do not turn the logo into an unlabeled control.
- Maintain the factual, calm voice: avoid `cheat`, `guilty`, `bad food`, punishment language, and body-shaming imagery.
- Preserve the product rule `interpret -> verify -> log`; brand polish must never imply that an estimate was confirmed when it was only previewed.

## Asset integrity

- Light source/copy SHA-256: `D9785FCC40B33CE4D08DCAA620F6D18965EC1AFC2C3CB896DB55EC5A35C6BBF1` (exact match verified).
- Dark source/copy SHA-256: `B0FDEA39C6134CD2E9E030D67AF33FD81B2993F67FF87EBDD441177958B13D06` (exact match verified).
- Both masters are intentionally retained byte-for-byte. Any future transparent launcher foreground should be produced as a separately reviewed derivative rather than silently replacing these originals.
