# Mobile app assets

App-consumable exports originate in `assets/brand/`. The mobile shell keeps the product name as live, configurable text rather than a raster wordmark.

Expected production exports:

- App icon source: `assets/brand/locked-and-lean-app-icon.png` (1024 × 1024 RGB)
- Adaptive foreground source: `assets/brand/locked-and-lean-mark.png` (1024 × 1024 RGBA)
- Splash mark source: `assets/brand/locked-and-lean-mark.png`
- Single-color variants: `assets/brand/locked-and-lean-mark-ink.png` and `locked-and-lean-mark-rice.png`

Root Expo config may reference those source files directly. Platform safe-zone checks are still required before release.
