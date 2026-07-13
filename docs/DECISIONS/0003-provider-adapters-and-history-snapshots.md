# ADR-0003: Replaceable nutrition adapters and immutable history snapshots

- Status: Accepted
- Date: 2026-07-12

## Context

Philippine packaged foods, restaurant formulations, home-cooked dishes, and generic composition data come from sources with different availability, licensing, market relevance, serving bases, and freshness. Provider records can change or disappear after a user logs food.

## Decision

Nutrition sources implement a versioned adapter contract that returns qualified observations. Adapters perform transport and source mapping only. Domain policy owns ranking, conflict handling, uncertainty, and preview selection.

When a preview is confirmed, each historical item stores the exact nutrition used plus food/brand/restaurant name, quantity and unit, serving basis, provider and provider record ID, provider/source version or retrieval time, market context, estimated status, confidence, uncertainty, and relevant attribution.

Confirmed history never performs a live provider join to calculate its calories or macros. Provider refresh affects only new previews. Historical correction creates an explicit user-reviewed replacement/update flow.

## Consequences

- providers can be added, removed, or replaced without rewriting history
- daily summaries remain reproducible from entry snapshots
- storage cost is higher than storing only provider IDs
- licensing and attribution fields must be preserved
- adapter fixtures and outages can be tested without network access and must be labeled as mocks

## Verification

Tests replace a provider record after confirmation and prove that the entry and summary do not change. Adapter contract tests cover malformed responses, null macros, foreign-market warnings, attribution, timeouts, and deterministic ranking of Philippine sources.
