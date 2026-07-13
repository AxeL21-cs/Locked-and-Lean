import type { PhilippineNutritionSourceKind } from "../../../../src/domain/localization/philippines";

export interface PhilippineProviderQueryContext {
  country: "PH";
  timezone: "Asia/Manila";
  userLocation?: string;
  marketEvidence?: readonly string[];
}

export interface PhilippineNutritionObservation {
  providerRecordId: string;
  sourceKind: PhilippineNutritionSourceKind;
  sourceName: string;
  market: "PH" | "foreign" | "unknown";
  servingDescription: string;
  measurableAmount: { quantity: number; unit: "g" | "ml" } | null;
  observedAt: string | null;
  attribution: string | null;
  warning: string | null;
}

export interface PhilippineNutritionProvider {
  readonly providerId: string;
  readonly accessStatus: "available" | "blocked_pending_legal_review";
  search(
    query: string,
    context: PhilippineProviderQueryContext,
  ): Promise<readonly PhilippineNutritionObservation[]>;
}

export const PHILFCT_PROVIDER_STATUS = {
  providerId: "philfct",
  accessStatus: "blocked_pending_legal_review",
  reason:
    "No dataset is bundled. Access, licensing, redistribution, and attribution must be verified before integration.",
} as const;
