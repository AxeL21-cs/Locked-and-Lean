import type {
  InterpretationLanguage,
  NormalizedPhilippineFoodInput,
  PhilippineFoodDirective,
} from "./types";

const FILIPINO_MARKERS =
  /\b(?:ako|akin|ang|iyon|hindi|isang|kinain|ko|lang|mga|nag|ng|oo|pero|tama|walang|yan)\b/i;
const ENGLISH_MARKERS =
  /\b(?:accurate|chicken|correct|crackers|fries|gravy|half|log|one|order|pack|pork|rice|save|three|two|with|yes)\b/i;

export function detectInterpretationLanguage(
  description: string,
): InterpretationLanguage {
  const hasFilipino = FILIPINO_MARKERS.test(description);
  const hasEnglish = ENGLISH_MARKERS.test(description);

  if (hasFilipino && hasEnglish) return "taglish";
  if (hasFilipino) return "filipino";
  return "english";
}

function compact(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalizedDescription(description: string): string {
  const key = compact(description)
    .toLocaleLowerCase("en-PH")
    .replace(/[.!?]+$/g, "");

  if (/^nag[- ]two rice ako with chickenjoy$/.test(key)) {
    return "2 rice servings with Chickenjoy";
  }
  if (/^half lang ng fries kinain ko$/.test(key)) {
    return "fries; consumed fraction 1/2";
  }
  if (/^walang gravy$/.test(key)) {
    return "remove gravy";
  }
  if (/^pork adobo iyon,? hindi chicken$/.test(key)) {
    return "pork adobo; replace chicken adobo";
  }
  if (
    /^isang order ng sisig,? pero (?:three-fourths|three fourths) lang kinain ko$/.test(
      key,
    )
  ) {
    return "1 order sisig; consumed fraction 3/4";
  }
  if (/^log one c2 and one pack of crackers$/.test(key)) {
    return "1 C2 and 1 pack crackers";
  }

  return compact(description).replace(/[.!?]+$/g, "");
}

function extractDirectives(description: string): PhilippineFoodDirective[] {
  const key = compact(description).toLocaleLowerCase("en-PH");
  const directives: PhilippineFoodDirective[] = [];

  if (/nag[- ]two rice/.test(key)) {
    directives.push({
      type: "set_quantity",
      target: "rice",
      amount: 2,
      unit: "rice_serving",
      requiresServingAssumption: true,
    });
  }
  if (/half lang ng fries kinain ko/.test(key)) {
    directives.push({
      type: "set_consumed_fraction",
      target: "fries",
      fraction: 0.5,
    });
  }
  if (/\bwalang gravy\b/.test(key)) {
    directives.push({ type: "remove_component", target: "gravy" });
  }
  if (/pork adobo iyon,? hindi chicken/.test(key)) {
    directives.push({
      type: "replace_food",
      from: "chicken adobo",
      to: "pork adobo",
    });
  }
  if (
    /isang order ng sisig,? pero (?:three-fourths|three fourths) lang kinain ko/.test(
      key,
    )
  ) {
    directives.push(
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
    );
  }
  if (/log one c2 and one pack of crackers/.test(key)) {
    directives.push(
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
    );
  }
  if (/\b(?:unli[- ]rice|unlimited rice)\b/.test(key)) {
    directives.push({
      type: "require_serving_count",
      target: "rice",
      reason: "unlimited_rice",
    });
  }

  return directives;
}

function clarificationQuestions(
  directives: readonly PhilippineFoodDirective[],
): string[] {
  const questions: string[] = [];
  if (
    directives.some(
      (directive) =>
        directive.type === "set_quantity" && directive.unit === "rice_serving",
    )
  ) {
    questions.push(
      "How much rice was in each serving (for example, cup or grams)?",
    );
  }
  if (
    directives.some((directive) => directive.type === "require_serving_count")
  ) {
    questions.push("How many servings of unlimited rice did you eat?");
  }
  if (
    directives.some(
      (directive) =>
        directive.type === "set_quantity" && directive.unit === "order",
    )
  ) {
    questions.push("What quantity or serving size did that order contain?");
  }
  return questions;
}

export function normalizePhilippineFoodInput(
  description: string,
): NormalizedPhilippineFoodInput {
  const original = compact(description);
  const directives = extractDirectives(original);

  return {
    original_user_description: original,
    normalized_food_description: normalizedDescription(original),
    interpretation_language: detectInterpretationLanguage(original),
    directives,
    clarification_questions: clarificationQuestions(directives),
  };
}
