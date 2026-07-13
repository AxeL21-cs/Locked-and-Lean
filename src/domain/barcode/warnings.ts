import { FOREIGN_MARKET_WARNING } from "../localization/philippines";
import type {
  BarcodeLookupContext,
  BarcodeProductCandidate,
  BarcodeWarning,
} from "./types";

const UNKNOWN_MARKET_WARNING =
  "The market version is not verified. Check the package label before confirming.";

function normalizeBrand(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-PH")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function sourceAgeDays(
  observedAt: string | null,
  now: string,
): number | null {
  if (!observedAt) return null;
  const observedTime = Date.parse(observedAt);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(observedTime) || !Number.isFinite(nowTime)) return null;
  return Math.max(0, (nowTime - observedTime) / 86_400_000);
}

export function warningsForBarcodeCandidate(
  candidate: BarcodeProductCandidate,
  context: BarcodeLookupContext,
): BarcodeWarning[] {
  const warnings: BarcodeWarning[] = [];
  if (candidate.market === "foreign") {
    warnings.push({
      code: "foreign_market",
      severity: "warning",
      message: FOREIGN_MARKET_WARNING,
    });
  } else if (candidate.market === "unknown") {
    warnings.push({
      code: "unknown_market",
      severity: "warning",
      message: UNKNOWN_MARKET_WARNING,
    });
  }

  if (
    context.expectedBrand &&
    normalizeBrand(context.expectedBrand) !==
      normalizeBrand(candidate.brandName ?? "")
  ) {
    warnings.push({
      code: "brand_mismatch",
      severity: "warning",
      message: `Scanned brand “${context.expectedBrand}” does not match source brand “${candidate.brandName ?? "not provided"}”.`,
    });
  }

  const ageDays = sourceAgeDays(candidate.source.observedAt, context.now);
  if (ageDays === null) {
    warnings.push({
      code: "freshness_unknown",
      severity: "warning",
      message: "The source observation date is unavailable.",
    });
  } else if (ageDays > context.freshnessLimitDays) {
    warnings.push({
      code: "stale_source",
      severity: "warning",
      message: `The source observation is ${Math.floor(ageDays)} days old; verify the current label.`,
    });
  }

  if (candidate.source.license.status === "unknown") {
    warnings.push({
      code: "license_unknown",
      severity: "blocking",
      message: "Source licensing is not verified for application use.",
    });
  }
  if (candidate.source.license.status === "blocked_pending_legal_review") {
    warnings.push({
      code: "license_blocked",
      severity: "blocking",
      message:
        "This source is blocked pending licensing and attribution review.",
    });
  }

  if (!candidate.nutrition.serving.measurableAmount) {
    warnings.push({
      code: "serving_unverified",
      severity: "warning",
      message:
        "The serving has no traceable gram or milliliter amount; confirm what one serving means.",
    });
  }

  if (
    candidate.nutrition.proteinG === null ||
    candidate.nutrition.carbohydratesG === null ||
    candidate.nutrition.fatG === null
  ) {
    warnings.push({
      code: "incomplete_macros",
      severity: "info",
      message: "One or more macros are unavailable and must remain unknown.",
    });
  }

  if (candidate.fixtureOnly) {
    warnings.push({
      code: "fixture_only",
      severity: "blocking",
      message:
        candidate.fixtureLabel ??
        "MOCK FIXTURE ONLY - not live product or nutrition data.",
    });
  }

  return warnings;
}

export function isCandidateUsable(
  candidate: BarcodeProductCandidate,
  allowFixtureCandidates = false,
): boolean {
  if (candidate.fixtureOnly && !allowFixtureCandidates) return false;
  return !["blocked_pending_legal_review", "unknown"].includes(
    candidate.source.license.status,
  );
}
