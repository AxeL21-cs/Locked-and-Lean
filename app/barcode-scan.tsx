import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { BarcodeScannerFlow } from "../src/features/barcode/BarcodeScannerFlow";
import type { BarcodeGateway } from "../src/features/barcode/types";
import { mobileApi } from "../src/services/supabase";

const gateway: BarcodeGateway = {
  lookupBarcode: (barcode) => mobileApi.lookupBarcode(barcode),
  createBarcodePreview: (input) => mobileApi.createBarcodePreview(input),
  confirmBarcodePreview: (previewId, revision, confirmationKey) =>
    mobileApi.confirmFoodPreview(previewId, revision, confirmationKey),
};

export default function BarcodeScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <BarcodeScannerFlow
      gateway={gateway}
      onChatGptHandoff={(barcode) =>
        Alert.alert(
          "ChatGPT handoff is not connected yet",
          `Phase 6 will add the external handoff for barcode ${barcode}. This mobile app does not call a model API. Use manual label entry for now.`,
        )
      }
      onLogged={() => {
        void queryClient.invalidateQueries({ queryKey: ["today"] });
        router.replace("/" as Href);
      }}
      onManualEntry={(barcode) =>
        router.push({
          pathname: "/manual-entry",
          params: barcode ? { barcode } : undefined,
        } as Href)
      }
      onSavedFoods={() => router.push("/saved-foods" as Href)}
    />
  );
}
