import {
  PHILIPPINE_SERVING_TERMS,
  modelServingAssumption,
  resolveDishAlias,
  resolveFastFoodAlias,
} from "..";

describe("Philippine aliases", () => {
  it.each([
    ["adobong manok", "chicken_adobo"],
    ["pakbet", "pinakbet"],
    ["pansit bihon", "pancit_bihon"],
    ["pan de sal", "pandesal"],
    ["halo halo", "halo_halo"],
  ])("resolves %s deterministically", (input, expectedId) => {
    expect(resolveDishAlias(input)?.canonicalId).toBe(expectedId);
  });

  it.each([
    ["McDo", "mcdonalds_ph", "chain"],
    ["Chicken Joy", "chickenjoy", "restaurant_item"],
    ["Paa", "chicken_inasal", "restaurant_item"],
    ["Siomai Chao Fan", "siomai_chao_fan", "restaurant_item"],
    ["Whopper", "whopper", "restaurant_item"],
  ])("resolves fast-food shorthand %s", (input, expectedId, expectedKind) => {
    expect(resolveFastFoodAlias(input)).toMatchObject({
      canonicalId: expectedId,
      kind: expectedKind,
    });
  });
});

describe("local serving terms", () => {
  it("contains metric and Filipino serving vocabulary from the brief", () => {
    expect(PHILIPPINE_SERVING_TERMS).toEqual(
      expect.arrayContaining([
        "gram",
        "milliliter",
        "rice cup",
        "baso",
        "mangkok",
        "sandok",
        "piraso",
        "balot",
        "supot",
      ]),
    );
  });

  it("does not assign a universal weight to one order", () => {
    const result = modelServingAssumption({ quantity: 1, term: "order" });

    expect(result.hasUniversalWeight).toBe(false);
    expect(result.clarificationRequired).toBe(true);
    expect(result.observation.measurableAmount).toBeUndefined();
  });

  it("accepts a traceable measured amount without making it universal", () => {
    const result = modelServingAssumption({
      quantity: 1,
      term: "mangkok",
      measurableAmount: {
        quantity: 180,
        unit: "g",
        sourceDescription: "user measured this bowl",
      },
    });

    expect(result).toMatchObject({
      hasUniversalWeight: false,
      clarificationRequired: false,
    });
  });
});
