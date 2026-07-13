import {
  BARCODE_FALLBACK_OPTIONS,
  MOCK_PHILIPPINE_BARCODE_PRODUCTS,
  rankBarcodeProductCandidates,
  resolveBarcodeProductLookup,
  warningsForBarcodeCandidate,
} from "..";
import type { BarcodeLookupContext, BarcodeProductCandidate } from "..";
import { PHILIPPINE_SOURCE_PRIORITY } from "../../localization/philippines";

const context: BarcodeLookupContext = {
  expectedBrand: "Fixture Foods PH",
  now: "2026-07-13T00:00:00.000Z",
  freshnessLimitDays: 180,
  allowFixtureCandidates: true,
};

function cloneCandidate(
  id: string,
  changes: Partial<BarcodeProductCandidate> = {},
): BarcodeProductCandidate {
  const base = MOCK_PHILIPPINE_BARCODE_PRODUCTS[1];
  if (!base) throw new Error("Missing mock fixture.");
  return {
    ...base,
    id,
    fixtureOnly: undefined,
    fixtureLabel: undefined,
    ...changes,
  };
}

describe("Philippine barcode ranking", () => {
  it("uses deterministic source priority and does not depend on input order", () => {
    const forward = rankBarcodeProductCandidates(
      "4006381333931",
      MOCK_PHILIPPINE_BARCODE_PRODUCTS,
      context,
    );
    const reverse = rankBarcodeProductCandidates(
      "4006381333931",
      [...MOCK_PHILIPPINE_BARCODE_PRODUCTS].reverse(),
      context,
    );

    expect(forward.map(({ id }) => id)).toEqual([
      "mock-private-saved-calamansi",
      "mock-open-ph-calamansi",
      "mock-foreign-calamansi",
    ]);
    expect(reverse.map(({ id }) => id)).toEqual(forward.map(({ id }) => id));
  });

  it("prefers Philippine market evidence for the same source kind", () => {
    const ranked = rankBarcodeProductCandidates(
      "4006381333931",
      [
        cloneCandidate("foreign", { market: "foreign" }),
        cloneCandidate("ph", { market: "PH" }),
      ],
      context,
    );

    expect(ranked.map(({ id }) => id)).toEqual(["ph", "foreign"]);
  });

  it("implements the complete documented provider priority", () => {
    const reversed = [...PHILIPPINE_SOURCE_PRIORITY]
      .reverse()
      .map((sourceKind, index) =>
        cloneCandidate(`candidate-${String(index).padStart(2, "0")}`, {
          sourceKind,
        }),
      );
    const ranked = rankBarcodeProductCandidates(
      "4006381333931",
      reversed,
      context,
    );

    expect(ranked.map(({ sourceKind }) => sourceKind)).toEqual(
      PHILIPPINE_SOURCE_PRIORITY,
    );
  });

  it("excludes sources whose licensing is unknown or blocked", () => {
    const blocked = cloneCandidate("blocked", {
      source: {
        ...cloneCandidate("source").source,
        license: {
          status: "blocked_pending_legal_review",
          name: null,
          url: null,
        },
      },
    });
    const resolution = resolveBarcodeProductLookup(
      blocked.gtin,
      [blocked],
      context,
    );

    expect(resolution).toMatchObject({ status: "unknown" });
    if (resolution.status !== "unknown") throw new Error("Expected unknown.");
    expect(resolution.rejectedCandidateWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "license_blocked",
          severity: "blocking",
        }),
      ]),
    );
  });
});

describe("lookup warnings and fallback", () => {
  it("surfaces market, freshness, brand, serving, macro, and fixture warnings", () => {
    const foreign = MOCK_PHILIPPINE_BARCODE_PRODUCTS[2];
    if (!foreign) throw new Error("Missing foreign mock fixture.");

    expect(warningsForBarcodeCandidate(foreign, context)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "foreign_market" }),
        expect.objectContaining({ code: "brand_mismatch" }),
        expect.objectContaining({ code: "stale_source" }),
        expect.objectContaining({ code: "fixture_only", severity: "blocking" }),
      ]),
    );

    const incomplete = cloneCandidate("incomplete", {
      market: "unknown",
      source: { ...cloneCandidate("source").source, observedAt: null },
      nutrition: {
        ...cloneCandidate("nutrition").nutrition,
        proteinG: null,
        serving: {
          quantity: 1,
          term: "piraso",
          measurableAmount: null,
        },
      },
    });
    expect(warningsForBarcodeCandidate(incomplete, context)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_market" }),
        expect.objectContaining({ code: "freshness_unknown" }),
        expect.objectContaining({ code: "serving_unverified" }),
        expect.objectContaining({ code: "incomplete_macros" }),
      ]),
    );
  });

  it("returns explicit manual, saved-food, and ChatGPT-label fallbacks", () => {
    const result = resolveBarcodeProductLookup("036000291452", [], context);
    expect(result).toMatchObject({ status: "unknown" });
    if (result.status !== "unknown") throw new Error("Expected unknown.");
    expect(result.fallback).toEqual(BARCODE_FALLBACK_OPTIONS);
    expect(result.fallback.map(({ action }) => action)).toEqual([
      "manual_entry",
      "saved_foods",
      "chatgpt_nutrition_label",
    ]);
  });

  it("requires explicit selection when equally ranked records disagree", () => {
    const first = cloneCandidate("candidate-a", {
      canonicalName: "Mock product A",
    });
    const second = cloneCandidate("candidate-b", {
      canonicalName: "Mock product B",
    });
    const result = resolveBarcodeProductLookup(
      first.gtin,
      [second, first],
      context,
    );

    expect(result).toMatchObject({
      status: "ambiguous",
      requiresProductSelection: true,
    });
    if (result.status !== "ambiguous") throw new Error("Expected ambiguity.");
    expect(result.matches.map(({ id }) => id)).toEqual([
      "candidate-a",
      "candidate-b",
    ]);
  });

  it("labels every bundled product as a synthetic fixture", () => {
    expect(MOCK_PHILIPPINE_BARCODE_PRODUCTS.length).toBeGreaterThan(0);
    for (const product of MOCK_PHILIPPINE_BARCODE_PRODUCTS) {
      expect(product.fixtureOnly).toBe(true);
      expect(product.fixtureLabel).toContain("MOCK FIXTURE ONLY");
      expect(product.source.providerDisplayName).toContain("MOCK");
    }
  });

  it("excludes fixtures unless a test context explicitly enables them", () => {
    expect(
      resolveBarcodeProductLookup(
        "4006381333931",
        MOCK_PHILIPPINE_BARCODE_PRODUCTS,
        { ...context, allowFixtureCandidates: false },
      ),
    ).toMatchObject({ status: "unknown" });
  });
});
