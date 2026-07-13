import { PHILIPPINE_SOURCE_PRIORITY } from "../localization/philippines";
import { normalizeGtin } from "./gtin";
import type {
  BarcodeLookupContext,
  BarcodeProductCandidate,
  ProductMarket,
} from "./types";
import { isCandidateUsable, sourceAgeDays } from "./warnings";

const MARKET_PRIORITY: Readonly<Record<ProductMarket, number>> = {
  PH: 0,
  unknown: 1,
  foreign: 2,
};

function normalizedBrand(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-PH")
    .replace(/[^a-z0-9]+/g, "");
}

export function barcodeCandidateRankKey(
  candidate: BarcodeProductCandidate,
  context: BarcodeLookupContext,
): readonly number[] {
  const sourcePriority = PHILIPPINE_SOURCE_PRIORITY.indexOf(
    candidate.sourceKind,
  );
  const brandMismatch = context.expectedBrand
    ? Number(
        normalizedBrand(context.expectedBrand) !==
          normalizedBrand(candidate.brandName),
      )
    : 0;
  const ageDays = sourceAgeDays(candidate.source.observedAt, context.now);
  const freshnessPriority =
    ageDays === null ? 1 : ageDays > context.freshnessLimitDays ? 2 : 0;

  return [
    sourcePriority === -1 ? Number.MAX_SAFE_INTEGER : sourcePriority,
    MARKET_PRIORITY[candidate.market],
    brandMismatch,
    freshnessPriority,
  ];
}

function compareRankKeys(left: readonly number[], right: readonly number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function rankBarcodeProductCandidates(
  scannedGtin: string,
  candidates: readonly BarcodeProductCandidate[],
  context: BarcodeLookupContext,
): BarcodeProductCandidate[] {
  const normalizedScan = normalizeGtin(scannedGtin);
  if (!normalizedScan.valid) return [];

  return candidates
    .filter((candidate) => {
      const candidateGtin = normalizeGtin(candidate.gtin);
      return (
        candidateGtin.valid &&
        candidateGtin.canonicalGtin14 === normalizedScan.canonicalGtin14 &&
        isCandidateUsable(candidate, context.allowFixtureCandidates)
      );
    })
    .map((candidate) => ({
      candidate,
      rank: barcodeCandidateRankKey(candidate, context),
    }))
    .sort((left, right) => {
      return (
        compareRankKeys(left.rank, right.rank) ||
        left.candidate.id.localeCompare(right.candidate.id, "en-PH")
      );
    })
    .map(({ candidate }) => candidate);
}

export function candidatesShareDecisionRank(
  left: BarcodeProductCandidate,
  right: BarcodeProductCandidate,
  context: BarcodeLookupContext,
): boolean {
  return (
    compareRankKeys(
      barcodeCandidateRankKey(left, context),
      barcodeCandidateRankKey(right, context),
    ) === 0
  );
}
