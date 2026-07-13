import { normalizeGtin } from "./gtin";
import {
  candidatesShareDecisionRank,
  rankBarcodeProductCandidates,
} from "./ranking";
import type {
  BarcodeFallbackOption,
  BarcodeLookupContext,
  BarcodeLookupResolution,
  BarcodeProductCandidate,
  BarcodeWarning,
} from "./types";
import { warningsForBarcodeCandidate } from "./warnings";

export const BARCODE_FALLBACK_OPTIONS: readonly BarcodeFallbackOption[] = [
  {
    action: "manual_entry",
    label: "Enter nutrition manually",
    explanation: "Use the package label and review a complete preview.",
  },
  {
    action: "saved_foods",
    label: "Check saved foods",
    explanation: "Search only products previously confirmed by this account.",
  },
  {
    action: "chatgpt_nutrition_label",
    label: "Use ChatGPT with the label",
    explanation:
      "In ChatGPT, share the nutrition label, review its interpretation, and confirm only the current preview.",
  },
];

function uniqueWarnings(warnings: readonly BarcodeWarning[]): BarcodeWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveBarcodeProductLookup(
  rawBarcode: string,
  candidates: readonly BarcodeProductCandidate[],
  context: BarcodeLookupContext,
): BarcodeLookupResolution {
  const barcode = normalizeGtin(rawBarcode);
  if (!barcode.valid) {
    return {
      status: "invalid_barcode",
      barcode,
      fallback: BARCODE_FALLBACK_OPTIONS,
    };
  }

  const ranked = rankBarcodeProductCandidates(rawBarcode, candidates, context);
  if (ranked.length === 0) {
    const rejected = candidates
      .filter((candidate) => {
        const candidateGtin = normalizeGtin(candidate.gtin);
        return (
          candidateGtin.valid &&
          candidateGtin.canonicalGtin14 === barcode.canonicalGtin14
        );
      })
      .flatMap((candidate) =>
        warningsForBarcodeCandidate(candidate, context).filter(
          (warning) => warning.severity === "blocking",
        ),
      );
    return {
      status: "unknown",
      barcode,
      fallback: BARCODE_FALLBACK_OPTIONS,
      rejectedCandidateWarnings: uniqueWarnings(rejected),
    };
  }

  const first = ranked[0];
  if (!first) {
    throw new Error("Ranked barcode candidates unexpectedly became empty.");
  }
  const equalTopMatches = ranked.filter((candidate) =>
    candidatesShareDecisionRank(first, candidate, context),
  );
  if (equalTopMatches.length > 1) {
    return {
      status: "ambiguous",
      barcode,
      matches: equalTopMatches,
      warnings: uniqueWarnings(
        equalTopMatches.flatMap((candidate) =>
          warningsForBarcodeCandidate(candidate, context),
        ),
      ),
      requiresProductSelection: true,
    };
  }

  return {
    status: "matched",
    barcode,
    selected: first,
    alternatives: ranked.slice(1),
    warnings: warningsForBarcodeCandidate(first, context),
    requiresServingSelection: true,
    requiresMealSelection: true,
  };
}
