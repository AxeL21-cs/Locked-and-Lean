// The transport boundary deliberately reuses the domain schemas. MCP inputs are
// untrusted, but a second, drifting definition would be worse than one strict schema.
export {
  chatGptCandidateListSchema,
  chatGptCandidateSchema,
  confidenceSchema,
  foodPreviewSchema,
  nutritionProviderMatchSchema,
  uncertaintySchema,
  userConfirmedCorrectionSchema,
} from "../../../../src/domain/food";
