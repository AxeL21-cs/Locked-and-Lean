import { normalizePhilippineFoodInput, type PhilippineFoodDirective } from "..";

const directiveOfType = <T extends PhilippineFoodDirective["type"]>(
  directives: readonly PhilippineFoodDirective[],
  type: T,
): Extract<PhilippineFoodDirective, { type: T }> | undefined =>
  directives.find(
    (directive): directive is Extract<PhilippineFoodDirective, { type: T }> =>
      directive.type === type,
  );

describe("Philippine English/Filipino/Taglish normalization", () => {
  it("parses the exact two-rice Chickenjoy example without translating the brand", () => {
    const result = normalizePhilippineFoodInput(
      "Nag-two rice ako with Chickenjoy.",
    );

    expect(result).toMatchObject({
      original_user_description: "Nag-two rice ako with Chickenjoy.",
      normalized_food_description: "2 rice servings with Chickenjoy",
      interpretation_language: "taglish",
    });
    expect(directiveOfType(result.directives, "set_quantity")).toEqual({
      type: "set_quantity",
      target: "rice",
      amount: 2,
      unit: "rice_serving",
      requiresServingAssumption: true,
    });
    expect(result.clarification_questions).toContain(
      "How much rice was in each serving (for example, cup or grams)?",
    );
  });

  it("parses the exact half-fries example as a consumed fraction", () => {
    const result = normalizePhilippineFoodInput(
      "Half lang ng fries kinain ko.",
    );

    expect(result.interpretation_language).toBe("taglish");
    expect(directiveOfType(result.directives, "set_consumed_fraction")).toEqual(
      {
        type: "set_consumed_fraction",
        target: "fries",
        fraction: 0.5,
      },
    );
  });

  it("turns the exact no-gravy example into a component removal instruction", () => {
    const result = normalizePhilippineFoodInput("Walang gravy.");

    expect(result.normalized_food_description).toBe("remove gravy");
    expect(result.interpretation_language).toBe("taglish");
    expect(directiveOfType(result.directives, "remove_component")).toEqual({
      type: "remove_component",
      target: "gravy",
    });
  });

  it("parses the exact pork-not-chicken adobo correction", () => {
    const result = normalizePhilippineFoodInput(
      "Pork adobo iyon, hindi chicken.",
    );

    expect(directiveOfType(result.directives, "replace_food")).toEqual({
      type: "replace_food",
      from: "chicken adobo",
      to: "pork adobo",
    });
    expect(result.interpretation_language).toBe("taglish");
  });

  it("parses the exact three-fourths sisig example without assigning order weight", () => {
    const result = normalizePhilippineFoodInput(
      "Isang order ng sisig, pero three-fourths lang kinain ko.",
    );

    expect(result.directives).toEqual(
      expect.arrayContaining([
        {
          type: "set_quantity",
          target: "sisig",
          amount: 1,
          unit: "order",
          requiresServingAssumption: true,
        },
        {
          type: "set_consumed_fraction",
          target: "sisig",
          fraction: 0.75,
        },
      ]),
    );
    expect(result.interpretation_language).toBe("taglish");
    expect(result.clarification_questions).toContain(
      "What quantity or serving size did that order contain?",
    );
  });

  it("parses the exact C2 and crackers example while preserving C2", () => {
    const result = normalizePhilippineFoodInput(
      "Log one C2 and one pack of crackers.",
    );

    expect(result.normalized_food_description).toBe("1 C2 and 1 pack crackers");
    expect(result.interpretation_language).toBe("english");
    expect(result.directives).toEqual([
      {
        type: "set_quantity",
        target: "C2",
        amount: 1,
        unit: "piece",
        requiresServingAssumption: true,
      },
      {
        type: "set_quantity",
        target: "crackers",
        amount: 1,
        unit: "pack",
        requiresServingAssumption: true,
      },
    ]);
  });

  it("requires a serving count for unlimited rice", () => {
    const result = normalizePhilippineFoodInput("Paa with unli-rice.");

    expect(directiveOfType(result.directives, "require_serving_count")).toEqual(
      {
        type: "require_serving_count",
        target: "rice",
        reason: "unlimited_rice",
      },
    );
    expect(result.clarification_questions).toContain(
      "How many servings of unlimited rice did you eat?",
    );
  });
});
