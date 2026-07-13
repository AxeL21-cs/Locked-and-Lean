export type InterpretationLanguage = "english" | "filipino" | "taglish";

export type PhilippineFoodDirective =
  | {
      type: "set_quantity";
      target: string;
      amount: number;
      unit: "piece" | "pack" | "order" | "rice_serving";
      requiresServingAssumption: boolean;
    }
  | {
      type: "set_consumed_fraction";
      target: string;
      fraction: number;
    }
  | {
      type: "remove_component";
      target: string;
    }
  | {
      type: "replace_food";
      from: string;
      to: string;
    }
  | {
      type: "require_serving_count";
      target: string;
      reason: "unlimited_rice";
    };

export interface NormalizedPhilippineFoodInput {
  original_user_description: string;
  normalized_food_description: string;
  interpretation_language: InterpretationLanguage;
  directives: PhilippineFoodDirective[];
  clarification_questions: string[];
}
