import type {
  BarcodeCandidate,
  BarcodeLookup,
  BarcodePreviewInput,
  FoodPreview,
} from "../../services/supabase";

export type BarcodeCandidateView = BarcodeCandidate;
export type BarcodeLookupView = BarcodeLookup;
export type BarcodePreviewRequest = BarcodePreviewInput;

export interface BarcodeGateway {
  lookupBarcode(barcode: string): Promise<BarcodeLookupView>;
  createBarcodePreview(input: BarcodePreviewRequest): Promise<FoodPreview>;
  confirmBarcodePreview(
    previewId: string,
    revision: number,
    idempotencyKey: string,
  ): Promise<{ entryId: string; reused: boolean }>;
}
