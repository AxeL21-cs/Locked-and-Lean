import {
  CONFLICTING_MARKET_WARNING,
  FOREIGN_MARKET_WARNING,
  MOCK_EDITABLE_COMBO_FIXTURES,
  assessPhilippineMarket,
  cloneEditableComboFixture,
  rankPhilippineSources,
  uncertaintyForPhilippineFood,
} from "..";

describe("Philippine market policy", () => {
  it("ranks exact Philippine label evidence above foreign generic sources", () => {
    const ranked = rankPhilippineSources([
      { id: "foreign", kind: "usda_generic", market: "foreign" },
      {
        id: "label",
        kind: "exact_ph_barcode_package_label",
        market: "PH",
      },
      {
        id: "estimate",
        kind: "comparable_estimate",
        market: "unknown",
      },
    ]);

    expect(ranked.map(({ id }) => id)).toEqual([
      "label",
      "foreign",
      "estimate",
    ]);
  });

  it("prefers a Philippine-market observation when source kinds are equal", () => {
    const ranked = rankPhilippineSources([
      { id: "foreign", kind: "manufacturer_ph_nutrition", market: "foreign" },
      { id: "philippine", kind: "manufacturer_ph_nutrition", market: "PH" },
    ]);

    expect(ranked.map(({ id }) => id)).toEqual(["philippine", "foreign"]);
  });

  it("shows the required warning for a foreign market item", () => {
    const assessment = assessPhilippineMarket({
      countryOfSale: "United States",
      barcodePrefix: "480",
    });

    expect(assessment).toEqual({
      market: "foreign",
      warning: FOREIGN_MARKET_WARNING,
      evidenceUsed: ["country_of_sale"],
      barcodePrefixIgnored: true,
    });
    expect(assessment.warning).toBe(
      "Philippine formulation or serving size may differ.",
    );
  });

  it("does not determine Philippine market status from barcode prefix alone", () => {
    expect(assessPhilippineMarket({ barcodePrefix: "480" })).toEqual({
      market: "unknown",
      warning: null,
      evidenceUsed: [],
      barcodePrefixIgnored: true,
    });
  });

  it("does not silently prefer one market when reliable evidence conflicts", () => {
    expect(
      assessPhilippineMarket({
        packageLabelCountry: "Philippines",
        countryOfSale: "United States",
        barcodePrefix: "480",
      }),
    ).toEqual({
      market: "unknown",
      warning: CONFLICTING_MARKET_WARNING,
      evidenceUsed: ["package_label", "country_of_sale"],
      barcodePrefixIgnored: true,
    });
  });
});

describe("editable Philippine fast-food fixture metadata", () => {
  it("decomposes a mock combo into independently editable components", () => {
    const fixture = MOCK_EDITABLE_COMBO_FIXTURES[0];

    expect(fixture).toMatchObject({
      fixtureOnly: true,
      nutritionAvailability: "not_provided",
      menuVersion: "fixture-unversioned",
    });
    expect(fixture?.components.map(({ id }) => id)).toEqual([
      "main",
      "rice",
      "gravy",
    ]);
    expect(fixture?.components.every(({ editable }) => editable)).toBe(true);
    expect(
      fixture?.components.every(({ nutrition }) => nutrition === null),
    ).toBe(true);
    expect(
      fixture?.components.find(({ id }) => id === "gravy")?.removable,
    ).toBe(true);
  });

  it("returns a mutable clone rather than an opaque shared total", () => {
    const clone = cloneEditableComboFixture(
      "mock-jollibee-chickenjoy-rice-meal",
    );

    expect(clone).not.toBe(MOCK_EDITABLE_COMBO_FIXTURES[0]);
    expect(clone?.components).not.toBe(
      MOCK_EDITABLE_COMBO_FIXTURES[0]?.components,
    );
  });
});

describe("Philippine street-food uncertainty", () => {
  it("keeps sauce, oil, coating, and piece-size uncertainty visible", () => {
    const uncertainty = uncertaintyForPhilippineFood("kwek-kwek");

    expect(uncertainty).toMatchObject({
      category: "street_food",
      confidence: "low",
    });
    expect(uncertainty?.unresolvedFactors).toEqual(
      expect.arrayContaining([
        "piece size",
        "batter or coating",
        "absorbed frying oil",
        "sauce consumed",
      ]),
    );
  });
});
