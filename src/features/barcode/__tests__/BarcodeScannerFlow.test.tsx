import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import type { FoodPreview } from "../../../services/supabase";
import { BarcodeScannerFlow } from "../BarcodeScannerFlow";
import type {
  BarcodeCandidateView,
  BarcodeGateway,
  BarcodeLookupView,
} from "../types";

const mockUseCameraPermissions = jest.fn();
let mockBarcodeHandler:
  | ((result: { data: string; type: string }) => Promise<void> | undefined)
  | undefined;

jest.mock("expo-camera", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    useCameraPermissions: () => mockUseCameraPermissions(),
    CameraView: ({ children, onBarcodeScanned, ...props }: any) => {
      mockBarcodeHandler = onBarcodeScanned;
      return React.createElement(
        View,
        props,
        React.createElement(
          Pressable,
          {
            accessibilityLabel: "Mock valid barcode scan",
            accessibilityRole: "button",
            onPress: () =>
              onBarcodeScanned?.({ data: "4006381333931", type: "ean13" }),
          },
          React.createElement(Text, null, "Trigger camera scan"),
        ),
        children,
      );
    },
  };
});

const candidate: BarcodeCandidateView = {
  productId: "product-1",
  servingId: "serving-1",
  name: "Peanut snack",
  brand: "Sample Brand",
  servingLabel: "1 pack (30 g)",
  caloriesPerServing: 170,
  proteinGPerServing: 6,
  carbohydratesGPerServing: 12,
  fatGPerServing: 11,
  providerName: "Licensed catalog",
  sourceAttribution: "Package label observed 2026-06-01",
  marketStatus: "unknown",
  warnings: ["Confirm this package matches the market and serving shown."],
};

const found: BarcodeLookupView = {
  status: "found",
  scanSessionId: "scan-1",
  barcode: "4006381333931",
  candidates: [candidate],
  warnings: ["Market could not be verified from the barcode alone."],
};

const preview: FoodPreview = {
  id: "preview-4",
  revision: 1,
  mealType: "lunch",
  consumedAt: "2026-07-13T12:00:00+08:00",
  expiresAt: "2026-07-13T12:30:00+08:00",
  items: [
    {
      id: "item-1",
      foodName: "Peanut snack",
      brand: "Sample Brand",
      servingDescription: "2 packs",
      calories: 340,
      proteinG: 12,
      carbohydratesG: 24,
      fatG: 22,
      estimated: false,
      confidence: 0.9,
      source: "Licensed catalog",
      uncertainty: ["Market could not be verified."],
    },
  ],
  totalCalories: 340,
  totalProteinG: 12,
  totalCarbohydratesG: 24,
  totalFatG: 22,
};

function gateway(overrides: Partial<BarcodeGateway> = {}): BarcodeGateway {
  return {
    lookupBarcode: jest.fn().mockResolvedValue(found),
    createBarcodePreview: jest.fn().mockResolvedValue(preview),
    confirmBarcodePreview: jest
      .fn()
      .mockResolvedValue({ entryId: "entry-1", reused: false }),
    ...overrides,
  };
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  fireEvent.press(element);
  await Promise.resolve();
}

const scanResult = { data: "4006381333931", type: "ean13" };

async function scanBarcode() {
  await act(async () => {
    await mockBarcodeHandler?.(scanResult);
  });
}

describe("BarcodeScannerFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("explains permission before requesting it and always offers manual entry", async () => {
    const request = jest.fn();
    mockUseCameraPermissions.mockReturnValue([
      { granted: false, canAskAgain: true },
      request,
    ]);
    const manual = jest.fn();
    const view = await render(
      <BarcodeScannerFlow
        gateway={gateway()}
        onChatGptHandoff={jest.fn()}
        onLogged={jest.fn()}
        onManualEntry={manual}
        onSavedFoods={jest.fn()}
      />,
    );

    expect(view.getByText("Why camera access?")).toBeTruthy();
    expect(view.getByText(/reads a product barcode only/i)).toBeTruthy();
    await press(
      view.getByRole("button", {
        name: "Enter barcode or food manually",
      }),
    );
    expect(manual).toHaveBeenCalledWith();
    expect(
      view.getByRole("button", { name: "Allow camera to scan" }),
    ).toBeTruthy();
  });

  it("routes a permanently denied permission to device settings", async () => {
    const settings = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValue(undefined);
    mockUseCameraPermissions.mockReturnValue([
      { granted: false, canAskAgain: false },
      jest.fn(),
    ]);
    const view = await render(
      <BarcodeScannerFlow
        gateway={gateway()}
        onChatGptHandoff={jest.fn()}
        onLogged={jest.fn()}
        onManualEntry={jest.fn()}
        onSavedFoods={jest.fn()}
      />,
    );

    expect(view.getByText("Camera access is off")).toBeTruthy();
    await press(view.getByRole("button", { name: "Open device settings" }));
    expect(settings).toHaveBeenCalledTimes(1);
  });

  it("locks duplicate callbacks during lookup and provides the exact unknown barcode to manual entry", async () => {
    mockUseCameraPermissions.mockReturnValue([
      { granted: true, canAskAgain: true },
      jest.fn(),
    ]);
    const lookup = jest.fn().mockResolvedValue({
      status: "unknown",
      scanSessionId: "scan-unknown",
      barcode: "4006381333931",
      warnings: ["No licensed match was available."],
    } satisfies BarcodeLookupView);
    const manual = jest.fn();
    const savedFoods = jest.fn();
    const chatGptHandoff = jest.fn();
    const view = await render(
      <BarcodeScannerFlow
        gateway={gateway({ lookupBarcode: lookup })}
        onChatGptHandoff={chatGptHandoff}
        onLogged={jest.fn()}
        onManualEntry={manual}
        onSavedFoods={savedFoods}
      />,
    );
    await act(async () => {
      const firstLookup = mockBarcodeHandler?.(scanResult);
      mockBarcodeHandler?.(scanResult);
      expect(lookup).toHaveBeenCalledTimes(1);
      await firstLookup;
    });

    expect(await view.findByText("Product not found")).toBeTruthy();
    await press(
      view.getByRole("button", { name: "Enter nutrition label manually" }),
    );
    expect(manual).toHaveBeenCalledWith("4006381333931");
    await press(view.getByRole("button", { name: "Check my saved foods" }));
    expect(savedFoods).toHaveBeenCalledTimes(1);
    await press(
      view.getByRole("button", { name: "View ChatGPT handoff guidance" }),
    );
    expect(chatGptHandoff).toHaveBeenCalledWith("4006381333931");
  });

  it("requires an explicit choice when lookup returns multiple candidates", async () => {
    mockUseCameraPermissions.mockReturnValue([
      { granted: true, canAskAgain: true },
      jest.fn(),
    ]);
    const alternative: BarcodeCandidateView = {
      ...candidate,
      productId: "product-2",
      servingId: "serving-2",
      name: "Peanut snack, imported version",
      marketStatus: "foreign",
    };
    const api = gateway({
      lookupBarcode: jest.fn().mockResolvedValue({
        ...found,
        candidates: [candidate, alternative],
      }),
    });
    const view = await render(
      <BarcodeScannerFlow
        gateway={api}
        onChatGptHandoff={jest.fn()}
        onLogged={jest.fn()}
        onManualEntry={jest.fn()}
        onSavedFoods={jest.fn()}
      />,
    );
    await scanBarcode();
    const create = view.getByRole("button", { name: "Create server preview" });
    expect(create.props.accessibilityState.disabled).toBe(true);
    await press(
      view.getByRole("radio", {
        name: /Peanut snack, imported version.*Foreign-market label/,
      }),
    );
    expect(
      view.getByRole("button", { name: "Create server preview" }).props
        .accessibilityState.disabled,
    ).toBe(false);
  });

  it("submits only lookup identifiers and choices, then confirms the exact server preview revision", async () => {
    mockUseCameraPermissions.mockReturnValue([
      { granted: true, canAskAgain: true },
      jest.fn(),
    ]);
    const api = gateway();
    const logged = jest.fn();
    const view = await render(
      <BarcodeScannerFlow
        gateway={api}
        onChatGptHandoff={jest.fn()}
        onLogged={logged}
        onManualEntry={jest.fn()}
        onSavedFoods={jest.fn()}
      />,
    );
    await scanBarcode();
    expect(await view.findByText("Choose the right product")).toBeTruthy();
    expect(view.getByText(/Market not verified/)).toBeTruthy();
    expect(view.getByText(/Source: Licensed catalog/)).toBeTruthy();
    expect(
      view.getByText("Market could not be verified from the barcode alone."),
    ).toBeTruthy();

    await press(view.getByRole("radio", { name: /2 servings/ }));
    await press(view.getByRole("radio", { name: "Meal: Lunch" }));
    await press(view.getByRole("button", { name: "Create server preview" }));
    await waitFor(() =>
      expect(api.createBarcodePreview).toHaveBeenCalledWith(
        expect.objectContaining({
          scanSessionId: "scan-1",
          foodProductId: "product-1",
          servingId: "serving-1",
          servingCount: 2,
          mealType: "lunch",
        }),
      ),
    );
    const submitted = (api.createBarcodePreview as jest.Mock).mock.calls[0][0];
    expect(submitted).not.toHaveProperty("calories");
    expect(submitted).not.toHaveProperty("proteinG");

    expect(await view.findByText("REVISION 1")).toBeTruthy();
    expect(view.getByText(/Source data · Licensed catalog/)).toBeTruthy();
    await press(
      view.getByRole("button", { name: "Confirm revision 1 and log it" }),
    );
    await waitFor(() =>
      expect(api.confirmBarcodePreview).toHaveBeenCalledWith(
        "preview-4",
        1,
        expect.any(String),
      ),
    );
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("distinguishes offline lookup, retries the same barcode, and never creates a preview", async () => {
    mockUseCameraPermissions.mockReturnValue([
      { granted: true, canAskAgain: true },
      jest.fn(),
    ]);
    const offline = Object.assign(new Error("Network request failed"), {
      kind: "offline",
    });
    const lookup = jest
      .fn()
      .mockRejectedValueOnce(offline)
      .mockResolvedValueOnce(found);
    const api = gateway({ lookupBarcode: lookup });
    const view = await render(
      <BarcodeScannerFlow
        gateway={api}
        onChatGptHandoff={jest.fn()}
        onLogged={jest.fn()}
        onManualEntry={jest.fn()}
        onSavedFoods={jest.fn()}
      />,
    );
    await scanBarcode();
    expect(await view.findByText("You’re offline")).toBeTruthy();
    expect(view.getByText("No food data was guessed")).toBeTruthy();
    expect(api.createBarcodePreview).not.toHaveBeenCalled();

    await press(view.getByRole("button", { name: /Retry lookup/ }));
    expect(await view.findByText("Choose the right product")).toBeTruthy();
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenLastCalledWith("4006381333931");
  });
});
