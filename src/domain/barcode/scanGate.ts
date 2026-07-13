import { normalizeGtin, normalizeScannedGtin } from "./gtin";
import type { BarcodeSymbology, NormalizedGtin } from "./types";

export type BarcodeScanDecision =
  | { accepted: true; barcode: NormalizedGtin }
  | {
      accepted: false;
      reason: "invalid_barcode" | "duplicate_within_debounce_window";
    };

export interface BarcodeScanGate {
  tryAccept(
    rawBarcode: string,
    observedAtMs: number,
    symbology?: BarcodeSymbology,
  ): BarcodeScanDecision;
  reset(rawBarcode?: string): void;
}

export function createBarcodeScanGate(debounceMs = 2_000): BarcodeScanGate {
  if (!Number.isFinite(debounceMs) || debounceMs < 0) {
    throw new Error("Barcode debounce duration must be zero or greater.");
  }
  const acceptedAt = new Map<string, number>();

  return {
    tryAccept(rawBarcode, observedAtMs, symbology) {
      const normalized = normalizeScannedGtin(rawBarcode, symbology);
      if (!normalized.valid || !Number.isFinite(observedAtMs)) {
        return { accepted: false, reason: "invalid_barcode" };
      }

      const previous = acceptedAt.get(normalized.canonicalGtin14);
      if (
        previous !== undefined &&
        observedAtMs >= previous &&
        observedAtMs - previous < debounceMs
      ) {
        return {
          accepted: false,
          reason: "duplicate_within_debounce_window",
        };
      }

      acceptedAt.set(normalized.canonicalGtin14, observedAtMs);
      return { accepted: true, barcode: normalized };
    },
    reset(rawBarcode) {
      if (rawBarcode === undefined) {
        acceptedAt.clear();
        return;
      }
      const normalized = normalizeGtin(rawBarcode);
      if (normalized.valid) acceptedAt.delete(normalized.canonicalGtin14);
    },
  };
}
