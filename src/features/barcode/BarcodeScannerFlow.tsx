import type { BarcodeScanningResult } from "expo-camera";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { ChoiceChips } from "../../components/ChoiceChips";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { PRODUCT } from "../../design-system/product";
import {
  type BarcodeSymbology,
  createBarcodeScanGate,
} from "../../domain/barcode";
import { localDateInManila } from "../../domain/localization/philippines";
import type { FoodPreview, MealType } from "../../services/supabase";
import { ManualPreviewCard } from "../add/ManualPreviewCard";
import type {
  BarcodeCandidateView,
  BarcodeGateway,
  BarcodeLookupView,
} from "./types";

const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "itf14"] as const;
const MEALS = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Snack", value: "snack" },
] as const;
const SERVING_COUNTS = [
  { label: "½ serving", value: "0.5" },
  { label: "1 serving", value: "1" },
  { label: "1½ servings", value: "1.5" },
  { label: "2 servings", value: "2" },
] as const;

const idempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `barcode-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const consumedAtInManila = () => {
  const now = new Date();
  const date = localDateInManila(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return `${date}T${time}+08:00`;
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected service error.";
}

function isOffline(error: unknown) {
  const candidate = error as { kind?: unknown; message?: unknown };
  return (
    candidate?.kind === "offline" ||
    /offline|network|fetch/i.test(String(candidate?.message ?? error))
  );
}

function macro(value: number | null) {
  return value == null ? "Unknown" : `${Math.round(value * 10) / 10} g`;
}

function marketLabel(status: BarcodeCandidateView["marketStatus"]) {
  if (status === "PH") return "Philippine-market label verified";
  if (status === "foreign") return "Foreign-market label";
  return "Market not verified";
}

function candidateKey(candidate: BarcodeCandidateView) {
  return `${candidate.productId}::${candidate.servingId ?? "default"}`;
}

function PermissionPanel({
  canAskAgain,
  requesting,
  error,
  onRequest,
  onManualEntry,
}: {
  canAskAgain: boolean;
  requesting: boolean;
  error?: string;
  onRequest: () => void;
  onManualEntry: () => void;
}) {
  return (
    <Screen>
      <ScreenHeader
        eyebrow="CAMERA · YOUR CONTROL"
        title="Scan a package barcode"
        annotation="Nothing logs from the camera"
      />
      <View accessibilityRole="summary" style={styles.permissionCard}>
        <Text style={styles.permissionMark}>▣</Text>
        <Text style={styles.permissionTitle}>
          {canAskAgain ? "Why camera access?" : "Camera access is off"}
        </Text>
        <Text style={styles.body}>
          The camera reads a product barcode only. {PRODUCT.name} does not use
          this scanner for food photos, and a scan starts lookup—not a food log.
        </Text>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {canAskAgain ? (
        <ActionButton
          busy={requesting}
          label="Allow camera to scan"
          onPress={onRequest}
          accessibilityHint="Opens the device camera permission prompt"
        />
      ) : (
        <ActionButton
          label="Open device settings"
          onPress={() => void Linking.openSettings()}
          accessibilityHint="Opens device settings where camera permission can be changed"
        />
      )}
      <ActionButton
        disabled={requesting}
        label="Enter barcode or food manually"
        onPress={onManualEntry}
        tone="secondary"
      />
    </Screen>
  );
}

function CandidateCard({
  candidate,
  selected,
  onPress,
}: {
  candidate: BarcodeCandidateView;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${candidate.name}, ${candidate.servingLabel}, ${marketLabel(candidate.marketStatus)}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.candidate, selected && styles.candidateSelected]}
    >
      <View style={styles.candidateTop}>
        <View style={styles.flex}>
          <Text style={styles.candidateName}>{candidate.name}</Text>
          <Text style={styles.candidateMeta}>
            {candidate.brand ? `${candidate.brand} · ` : ""}
            {candidate.servingLabel}
          </Text>
        </View>
        <Text style={styles.kcal}>
          {Math.round(candidate.caloriesPerServing)} kcal
        </Text>
      </View>
      <Text style={styles.market}>
        {selected ? "●" : "○"} {marketLabel(candidate.marketStatus)}
      </Text>
      <Text style={styles.source}>
        Source: {candidate.providerName}
        {candidate.sourceAttribution ? ` · ${candidate.sourceAttribution}` : ""}
      </Text>
      <Text style={styles.macros}>
        Per listed serving · P {macro(candidate.proteinGPerServing)} · C{" "}
        {macro(candidate.carbohydratesGPerServing)} · F{" "}
        {macro(candidate.fatGPerServing)}
      </Text>
    </Pressable>
  );
}

function ProductReview({
  lookup,
  selectedCandidateKey,
  servingCount,
  mealType,
  previewing,
  previewError,
  onSelectCandidate,
  onServingCount,
  onMealType,
  onCreatePreview,
  onScanAgain,
  onManualEntry,
}: {
  lookup: Extract<BarcodeLookupView, { status: "found" }>;
  selectedCandidateKey: string;
  servingCount: string;
  mealType: MealType;
  previewing: boolean;
  previewError?: unknown;
  onSelectCandidate: (key: string) => void;
  onServingCount: (value: string) => void;
  onMealType: (value: MealType) => void;
  onCreatePreview: () => void;
  onScanAgain: () => void;
  onManualEntry: () => void;
}) {
  const selected = lookup.candidates.find(
    (candidate) => candidateKey(candidate) === selectedCandidateKey,
  );
  const warnings = [
    ...new Set([...lookup.warnings, ...(selected?.warnings ?? [])]),
  ];
  return (
    <Screen>
      <ScreenHeader
        eyebrow="FOUND · VERIFY THE LABEL"
        title="Choose the right product"
        annotation={`Barcode ${lookup.barcode}`}
      />
      <Text style={styles.reviewIntro}>
        Match the product, market and serving to your package. Listed values are
        source data only; the server calculates the complete preview next.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.candidateList}>
        {lookup.candidates.map((candidate) => (
          <CandidateCard
            candidate={candidate}
            key={candidateKey(candidate)}
            onPress={() => onSelectCandidate(candidateKey(candidate))}
            selected={candidateKey(candidate) === selectedCandidateKey}
          />
        ))}
      </View>
      {warnings.map((warning) => (
        <View accessibilityRole="alert" key={warning} style={styles.warning}>
          <Text style={styles.warningTitle}>! SOURCE CHECK</Text>
          <Text style={styles.warningBody}>{warning}</Text>
        </View>
      ))}
      <ChoiceChips
        choices={SERVING_COUNTS}
        label="How many listed servings?"
        onChange={onServingCount}
        value={servingCount}
      />
      <ChoiceChips<MealType>
        choices={MEALS}
        label="Meal"
        onChange={onMealType}
        value={mealType}
      />
      {previewError ? (
        <AsyncStatePanel
          actionLabel="Retry preview"
          kind={isOffline(previewError) ? "offline" : "error"}
          message={messageOf(previewError)}
          onAction={onCreatePreview}
          title={
            isOffline(previewError)
              ? "Preview needs a connection"
              : "Preview could not be created"
          }
        />
      ) : null}
      <ActionButton
        busy={previewing}
        disabled={!selected}
        label="Create server preview"
        onPress={onCreatePreview}
        accessibilityHint="Creates a review-only preview; it does not log food"
      />
      <ActionButton
        disabled={previewing}
        label="Scan a different barcode"
        onPress={onScanAgain}
        tone="secondary"
      />
      <Pressable
        accessibilityRole="button"
        onPress={onManualEntry}
        style={styles.textAction}
      >
        <Text style={styles.textActionLabel}>Product details look wrong?</Text>
        <Text style={styles.textActionCopy}>Enter label values manually →</Text>
      </Pressable>
    </Screen>
  );
}

export function BarcodeScannerFlow({
  gateway,
  onManualEntry,
  onSavedFoods,
  onChatGptHandoff,
  onLogged,
}: {
  gateway: BarcodeGateway;
  onManualEntry: (barcode?: string) => void;
  onSavedFoods: () => void;
  onChatGptHandoff: (barcode: string) => void;
  onLogged: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string>();
  const [lookup, setLookup] = useState<BarcodeLookupView>();
  const [lookupError, setLookupError] = useState<unknown>();
  const [lookingUp, setLookingUp] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string>();
  const [scanNotice, setScanNotice] = useState<string>();
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const [servingCount, setServingCount] = useState("1");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [preview, setPreview] = useState<FoodPreview>();
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<unknown>();
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<unknown>();
  const confirmationKey = useRef(idempotencyKey());
  const scanGate = useMemo(() => createBarcodeScanGate(2_000), []);
  const scanInFlight = useRef(false);

  const runLookup = async (barcode: string) => {
    setLookingUp(true);
    setLookupError(undefined);
    setScanNotice(undefined);
    try {
      const result = await gateway.lookupBarcode(barcode);
      setLookup(result);
      setSelectedCandidateKey(
        result.status === "found" &&
          result.candidates.length === 1 &&
          result.candidates[0]
          ? candidateKey(result.candidates[0])
          : "",
      );
    } catch (error) {
      setLookupError(error);
    } finally {
      scanInFlight.current = false;
      setLookingUp(false);
    }
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanInFlight.current) return;
    const decision = scanGate.tryAccept(
      result.data,
      Date.now(),
      result.type as BarcodeSymbology,
    );
    if (!decision.accepted) {
      if (decision.reason === "invalid_barcode")
        setScanNotice(
          "That code is not a supported product barcode. Try again.",
        );
      return;
    }
    scanInFlight.current = true;
    setLastBarcode(decision.barcode.digits);
    return runLookup(decision.barcode.digits);
  };

  const resetScanner = () => {
    scanGate.reset();
    scanInFlight.current = false;
    setLookup(undefined);
    setLookupError(undefined);
    setLastBarcode(undefined);
    setScanNotice(undefined);
    setPreview(undefined);
    setPreviewError(undefined);
    setConfirmError(undefined);
    setServingCount("1");
    setSelectedCandidateKey("");
    confirmationKey.current = idempotencyKey();
  };

  const createPreview = async () => {
    if (lookup?.status !== "found") return;
    const candidate = lookup.candidates.find(
      (item) => candidateKey(item) === selectedCandidateKey,
    );
    if (!candidate) return;
    setPreviewing(true);
    setPreviewError(undefined);
    try {
      const result = await gateway.createBarcodePreview({
        scanSessionId: lookup.scanSessionId,
        foodProductId: candidate.productId,
        servingId: candidate.servingId,
        servingCount: Number(servingCount),
        mealType,
        consumedAt: consumedAtInManila(),
        originalDescription: `${candidate.brand ? `${candidate.brand} ` : ""}${candidate.name} · barcode ${lookup.barcode}`,
      });
      confirmationKey.current = idempotencyKey();
      setPreview(result);
    } catch (error) {
      setPreviewError(error);
    } finally {
      setPreviewing(false);
    }
  };

  const confirmPreview = async () => {
    if (!preview) return;
    setConfirming(true);
    setConfirmError(undefined);
    try {
      await gateway.confirmBarcodePreview(
        preview.id,
        preview.revision,
        confirmationKey.current,
      );
      onLogged();
    } catch (error) {
      setConfirmError(error);
    } finally {
      setConfirming(false);
    }
  };

  if (permission == null)
    return (
      <Screen>
        <AsyncStatePanel
          kind="loading"
          message="Checking camera access on this device."
          title="Preparing the scanner"
        />
      </Screen>
    );

  if (!permission.granted)
    return (
      <PermissionPanel
        canAskAgain={permission.canAskAgain}
        error={permissionError}
        onManualEntry={() => onManualEntry()}
        onRequest={() => {
          setRequestingPermission(true);
          setPermissionError(undefined);
          void requestPermission()
            .catch((error: unknown) => setPermissionError(messageOf(error)))
            .finally(() => setRequestingPermission(false));
        }}
        requesting={requestingPermission}
      />
    );

  if (preview)
    return (
      <Screen>
        <ManualPreviewCard
          confirming={confirming}
          error={confirmError ? messageOf(confirmError) : undefined}
          onConfirm={() => void confirmPreview()}
          onEdit={() => {
            setPreview(undefined);
            setConfirmError(undefined);
            confirmationKey.current = idempotencyKey();
          }}
          preview={preview}
        />
      </Screen>
    );

  if (lookup?.status === "found")
    return (
      <ProductReview
        lookup={lookup}
        mealType={mealType}
        onCreatePreview={() => void createPreview()}
        onManualEntry={() => onManualEntry(lookup.barcode)}
        onMealType={setMealType}
        onScanAgain={resetScanner}
        onSelectCandidate={setSelectedCandidateKey}
        onServingCount={setServingCount}
        previewError={previewError}
        previewing={previewing}
        selectedCandidateKey={selectedCandidateKey}
        servingCount={servingCount}
      />
    );

  if (lookup?.status === "unknown")
    return (
      <Screen>
        <ScreenHeader
          eyebrow="NO VERIFIED MATCH"
          title="Product not found"
          annotation={`Barcode ${lookup.barcode}`}
        />
        <AsyncStatePanel
          kind="empty"
          message="No usable product match was returned. The barcode alone cannot establish Philippine-market nutrition."
          title="Keep the label in your hands"
        />
        {lookup.warnings.map((warning) => (
          <Text accessibilityRole="alert" key={warning} style={styles.error}>
            ! {warning}
          </Text>
        ))}
        <ActionButton
          label="Enter nutrition label manually"
          onPress={() => onManualEntry(lookup.barcode)}
        />
        <ActionButton
          label="Check my saved foods"
          onPress={onSavedFoods}
          tone="secondary"
        />
        <View style={styles.chatFallback}>
          <Text style={styles.chatFallbackTitle}>
            Have the nutrition label?
          </Text>
          <Text style={styles.chatFallbackBody}>
            You can hand the label to ChatGPT for interpretation. This mobile
            app does not run AI scanning or call a model API, and any result
            must still return as a preview for your confirmation.
          </Text>
          <ActionButton
            label="View ChatGPT handoff guidance"
            onPress={() => onChatGptHandoff(lookup.barcode)}
            tone="secondary"
          />
        </View>
        <ActionButton
          label="Scan another barcode"
          onPress={resetScanner}
          tone="secondary"
        />
      </Screen>
    );

  if (lookupError)
    return (
      <Screen>
        <ScreenHeader
          eyebrow="LOOKUP PAUSED"
          title={isOffline(lookupError) ? "You’re offline" : "Lookup failed"}
          annotation={lastBarcode ? `Barcode ${lastBarcode}` : undefined}
        />
        <AsyncStatePanel
          actionLabel="Retry lookup"
          kind={isOffline(lookupError) ? "offline" : "error"}
          message={messageOf(lookupError)}
          onAction={() => lastBarcode && void runLookup(lastBarcode)}
          title={
            isOffline(lookupError)
              ? "No food data was guessed"
              : "No preview was created"
          }
        />
        <ActionButton
          label="Enter barcode or food manually"
          onPress={() => onManualEntry(lastBarcode)}
          tone="secondary"
        />
        <ActionButton
          label="Return to scanner"
          onPress={resetScanner}
          tone="secondary"
        />
      </Screen>
    );

  return (
    <View style={styles.cameraScreen}>
      <CameraView
        accessibilityLabel="Product barcode camera"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        facing="back"
        onBarcodeScanned={lookingUp ? undefined : onBarcodeScanned}
        style={styles.camera}
      >
        <View pointerEvents="none" style={styles.cameraShade}>
          <View style={styles.scanHeader}>
            <Text style={styles.scanEyebrow}>PACKAGE BARCODE</Text>
            <Text style={styles.scanTitle}>Center the bars</Text>
            <Text style={styles.scanCopy}>
              Hold steady. One valid code pauses the camera while we look it up.
            </Text>
          </View>
          <View style={styles.reticle}>
            <View style={styles.scanLine} />
          </View>
          <View style={styles.cameraFoot}>
            <Text style={styles.cameraPrivacy}>
              SCAN → LOOKUP → PREVIEW → CONFIRM
            </Text>
          </View>
        </View>
      </CameraView>
      {scanNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.scanNotice}>
          {scanNotice}
        </Text>
      ) : null}
      {lookingUp ? (
        <View style={styles.lookupOverlay}>
          <AsyncStatePanel
            kind="loading"
            message={`Checking barcode ${lastBarcode ?? ""} against available product sources.`}
            title="Looking up the package"
          />
        </View>
      ) : null}
      <View style={styles.manualDock}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onManualEntry(lastBarcode)}
          style={styles.manualDockButton}
        >
          <Text style={styles.manualDockText}>
            Can’t scan? Enter it manually
          </Text>
        </Pressable>
        {Platform.OS === "web" ? (
          <Text style={styles.webNote}>
            Browser camera support varies by device and permission policy.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  permissionCard: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  permissionMark: { color: colors.calamansiDeep, fontSize: 34 },
  permissionTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 27,
    marginTop: spacing.md,
  },
  error: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  reviewIntro: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xl,
  },
  candidateList: { gap: spacing.md, marginTop: spacing.lg },
  candidate: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 144,
    padding: spacing.lg,
  },
  candidateSelected: { borderColor: colors.ink, borderWidth: 2 },
  candidateTop: { flexDirection: "row", gap: spacing.md },
  candidateName: { color: colors.ink, fontFamily: type.display, fontSize: 22 },
  candidateMeta: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 3,
  },
  kcal: { color: colors.ink, fontFamily: type.label, fontSize: 13 },
  market: {
    color: colors.calamansiDeep,
    fontFamily: type.bodyStrong,
    fontSize: 11,
    marginTop: spacing.md,
  },
  source: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 10,
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  macros: {
    color: colors.inkMuted,
    fontFamily: type.label,
    fontSize: 10,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  warning: {
    backgroundColor: colors.tomatoWash,
    borderRadius: radius.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  warningTitle: {
    color: "#9F2D17",
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  warningBody: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  textAction: {
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
  },
  textActionLabel: { color: colors.ink, fontFamily: type.bodyStrong },
  textActionCopy: {
    color: colors.calamansiDeep,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 2,
  },
  chatFallback: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  chatFallbackTitle: {
    color: colors.calamansi,
    fontFamily: type.display,
    fontSize: 20,
  },
  chatFallbackBody: {
    color: colors.riceDark,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  cameraScreen: { backgroundColor: colors.ink, flex: 1 },
  camera: { flex: 1 },
  cameraShade: {
    backgroundColor: "rgba(8,18,12,0.38)",
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 120,
    paddingHorizontal: spacing.lg,
    paddingTop: 66,
  },
  scanHeader: { alignItems: "center" },
  scanEyebrow: {
    color: colors.calamansi,
    fontFamily: type.label,
    fontSize: 10,
    letterSpacing: 2,
  },
  scanTitle: {
    color: colors.rice,
    fontFamily: type.display,
    fontSize: 35,
    marginTop: spacing.sm,
  },
  scanCopy: {
    color: colors.riceDark,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    maxWidth: 300,
    textAlign: "center",
  },
  reticle: {
    alignSelf: "center",
    borderColor: colors.calamansi,
    borderRadius: radius.lg,
    borderWidth: 3,
    height: 176,
    justifyContent: "center",
    maxWidth: 340,
    width: "100%",
  },
  scanLine: {
    backgroundColor: colors.tomato,
    height: 2,
    marginHorizontal: spacing.md,
  },
  cameraFoot: { alignItems: "center" },
  cameraPrivacy: {
    color: colors.rice,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  scanNotice: {
    backgroundColor: colors.tomatoWash,
    bottom: 110,
    color: colors.ink,
    fontFamily: type.bodyStrong,
    left: spacing.lg,
    padding: spacing.md,
    position: "absolute",
    right: spacing.lg,
    textAlign: "center",
  },
  lookupOverlay: {
    backgroundColor: colors.rice,
    bottom: 0,
    left: 0,
    padding: spacing.lg,
    position: "absolute",
    right: 0,
    top: 0,
  },
  manualDock: {
    backgroundColor: colors.ink,
    bottom: 0,
    left: 0,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    position: "absolute",
    right: 0,
  },
  manualDockButton: {
    alignItems: "center",
    borderColor: colors.riceDark,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
  },
  manualDockText: { color: colors.rice, fontFamily: type.label, fontSize: 12 },
  webNote: {
    color: colors.riceDark,
    fontFamily: type.body,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
