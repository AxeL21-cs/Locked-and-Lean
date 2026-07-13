import type {
  PhilippineNutritionSourceKind,
  PhilippineServingTerm,
} from "../localization/philippines";

export type GtinFormat = "GTIN-8" | "UPC-A" | "UPC-E" | "EAN-13" | "GTIN-14";

export type BarcodeSymbology = "ean8" | "ean13" | "upc_a" | "upc_e" | "itf14";

export type GtinErrorCode =
  "empty" | "non_numeric" | "unsupported_length" | "invalid_check_digit";

export type NormalizedGtin = {
  valid: true;
  raw: string;
  digits: string;
  scannedDigits?: string;
  canonicalGtin14: string;
  format: GtinFormat;
  checkDigit: number;
};

export type InvalidGtin = {
  valid: false;
  raw: string;
  code: GtinErrorCode;
  message: string;
};

export type GtinNormalizationResult = NormalizedGtin | InvalidGtin;

export type ProductMarket = "PH" | "foreign" | "unknown";

export type ProductLicenseStatus =
  | "private_user_data"
  | "licensed_for_use"
  | "open_licensed"
  | "blocked_pending_legal_review"
  | "unknown";

export interface ProductSourceLicense {
  status: ProductLicenseStatus;
  name: string | null;
  url: string | null;
}

export interface ProductSourceProvenance {
  providerId: string;
  providerDisplayName: string;
  providerRecordId: string;
  observedAt: string | null;
  attribution: string | null;
  license: ProductSourceLicense;
}

export interface ProductServingBasis {
  quantity: number;
  term: PhilippineServingTerm;
  measurableAmount: {
    quantity: number;
    unit: "g" | "ml";
    sourceDescription: string;
  } | null;
}

export interface BarcodeNutritionObservation {
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  serving: ProductServingBasis;
}

export interface BarcodeProductCandidate {
  id: string;
  gtin: string;
  canonicalName: string;
  brandName: string | null;
  sourceKind: PhilippineNutritionSourceKind;
  source: ProductSourceProvenance;
  market: ProductMarket;
  marketEvidence: readonly string[];
  nutrition: BarcodeNutritionObservation;
  fixtureOnly?: true;
  fixtureLabel?: string;
}

export type BarcodeWarningCode =
  | "foreign_market"
  | "unknown_market"
  | "brand_mismatch"
  | "stale_source"
  | "freshness_unknown"
  | "license_unknown"
  | "license_blocked"
  | "serving_unverified"
  | "incomplete_macros"
  | "fixture_only";

export interface BarcodeWarning {
  code: BarcodeWarningCode;
  severity: "info" | "warning" | "blocking";
  message: string;
}

export interface BarcodeLookupContext {
  expectedBrand?: string;
  now: string;
  freshnessLimitDays: number;
  allowFixtureCandidates?: boolean;
}

export type BarcodeFallbackAction =
  "manual_entry" | "saved_foods" | "chatgpt_nutrition_label";

export interface BarcodeFallbackOption {
  action: BarcodeFallbackAction;
  label: string;
  explanation: string;
}

export type BarcodeLookupResolution =
  | {
      status: "invalid_barcode";
      barcode: InvalidGtin;
      fallback: readonly BarcodeFallbackOption[];
    }
  | {
      status: "unknown";
      barcode: NormalizedGtin;
      fallback: readonly BarcodeFallbackOption[];
      rejectedCandidateWarnings: readonly BarcodeWarning[];
    }
  | {
      status: "ambiguous";
      barcode: NormalizedGtin;
      matches: readonly BarcodeProductCandidate[];
      warnings: readonly BarcodeWarning[];
      requiresProductSelection: true;
    }
  | {
      status: "matched";
      barcode: NormalizedGtin;
      selected: BarcodeProductCandidate;
      alternatives: readonly BarcodeProductCandidate[];
      warnings: readonly BarcodeWarning[];
      requiresServingSelection: true;
      requiresMealSelection: true;
    };

export type BarcodeMealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface QualifiedServingSelection {
  quantity: number;
  term: PhilippineServingTerm;
  measurableAmount: ProductServingBasis["measurableAmount"];
  clarificationRequired: boolean;
  clarificationQuestion: string | null;
}

export interface BarcodePreviewState {
  sourceKind: "barcode";
  serverPreviewId: string;
  revision: number;
  presentedRevision: number | null;
  status: "draft" | "ready";
  selectedProductId: string;
  mealType: BarcodeMealType;
  serving: QualifiedServingSelection;
  permanentWrite: false;
}

export type BarcodeConfirmationDecision =
  | {
      ok: false;
      reason:
        | "explicit_confirmation_required"
        | "preview_not_presented"
        | "stale_revision"
        | "invalid_idempotency_key";
    }
  | {
      ok: true;
      rpc: "confirm_food_log";
      args: {
        p_preview_id: string;
        p_confirmed_revision: number;
        p_confirmation: true;
        p_idempotency_key: string;
      };
    };
