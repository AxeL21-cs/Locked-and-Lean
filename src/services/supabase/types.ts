import type { Session } from "@supabase/supabase-js";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type FormulaSex = "female" | "male";
export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extra_active";
export type Goal = "lose" | "maintain" | "gain";

export type ProfileInput = {
  displayName: string;
  ageYears: number;
  formulaSex: FormulaSex;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  preferredUnits: "metric";
  timezone: string;
  targetRateKgPerWeek?: number;
};

export type GoalSetup = {
  displayName: string | null;
  ageYears: number | null;
  formulaSex: FormulaSex | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  activityLevel: ActivityLevel | null;
  requestedWeeklyChangeKg: number | null;
  hasConfirmedTarget: boolean;
};

export type NutritionTarget = {
  id: string;
  status: "proposed" | "confirmed";
  effectiveFrom: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbohydrateTargetG: number;
  fatTargetG: number;
  formulaName: string;
  formulaVersion: string;
  ageYears: number;
  formulaSex: FormulaSex;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  currentBmi: number;
  targetBmi: number;
  activityLevel: ActivityLevel;
  activityMultiplier: number;
  goal: Goal;
  maintenanceCalories: number;
  calorieAdjustment: number;
  requestedWeeklyChangeKg: number;
  appliedWeeklyChangeKg: number;
  estimatedGoalDate: string;
  calorieFloor: number;
  assumptions: string[];
  disclaimer: string;
};

export type ManualFoodInput = {
  barcode?: string;
  brand?: string;
  calories: number;
  carbohydratesG?: number;
  consumedDate: string;
  consumedTime: string;
  fatG?: number;
  foodName: string;
  mealType: MealType;
  proteinG?: number;
  quantity: number;
  saveForReuse: boolean;
  servingUnit: string;
};

export type FoodPreviewItem = {
  id: string;
  foodName: string;
  brand?: string;
  servingDescription: string;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  estimated: boolean;
  confidence: number | null;
  source: string;
  uncertainty: string[];
};

export type FoodPreview = {
  id: string;
  revision: number;
  mealType: MealType;
  consumedAt: string;
  expiresAt: string;
  items: FoodPreviewItem[];
  totalCalories: number;
  totalProteinG: number | null;
  totalCarbohydratesG: number | null;
  totalFatG: number | null;
};

export type FoodEntry = {
  id: string;
  mealType: MealType;
  consumedAt: string;
  name: string;
  serving: string;
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  source: string;
  estimated: boolean;
  confidence: number | null;
};

export type TodaySummary = {
  localDate: string;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbohydrateTargetG: number | null;
  fatTargetG: number | null;
  caloriesConsumed: number;
  proteinConsumedG: number;
  carbohydratesConsumedG: number;
  fatConsumedG: number;
  entries: FoodEntry[];
  lastUpdatedAt: string;
};

export type SavedFood = {
  id: string;
  foodName: string;
  brand?: string;
  serving: string;
  calories: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
};

export type WeightLog = {
  id: string;
  weightKg: number;
  measuredAt: string;
};

export type BarcodeMarketStatus = "PH" | "foreign" | "unknown";

export type BarcodeCandidate = {
  productId: string;
  servingId: string | null;
  name: string;
  brand?: string;
  servingLabel: string;
  caloriesPerServing: number;
  proteinGPerServing: number | null;
  carbohydratesGPerServing: number | null;
  fatGPerServing: number | null;
  providerName: string;
  sourceAttribution?: string;
  marketStatus: BarcodeMarketStatus;
  warnings: string[];
};

export type BarcodeLookup =
  | {
      status: "unknown";
      scanSessionId: string;
      barcode: string;
      warnings: string[];
    }
  | {
      status: "found";
      scanSessionId: string;
      barcode: string;
      candidates: BarcodeCandidate[];
      warnings: string[];
    };

export type BarcodePreviewInput = {
  scanSessionId: string;
  foodProductId: string;
  servingId: string | null;
  servingCount: number;
  mealType: MealType;
  consumedAt: string;
  originalDescription: string;
};

export type CalendarHistoryDay = {
  localDate: string;
  entryCount: number;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  macroDataComplete: boolean;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbohydrateTargetG: number | null;
  fatTargetG: number | null;
  weightKg: number | null;
  hasEntries: boolean;
  serverCalculatedAt: string;
};

export type HistoryDayItem = {
  id: string;
  foodProductId: string | null;
  foodName: string;
  brand?: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  provider: string;
  providerIdentifier: string | null;
  providerVersion: string | null;
  providerRetrievedAt: string | null;
  attribution?: string;
  marketCountryCode: string | null;
  estimated: boolean;
  confidence: number | null;
  uncertainty: string[];
};

export type HistoryDayEntry = {
  id: string;
  sourceKind: string;
  mealType: MealType;
  consumedAt: string;
  localDate: string;
  originalDescription: string;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  macroDataComplete: boolean;
  items: HistoryDayItem[];
};

export type DayHistory = {
  localDate: string;
  entries: HistoryDayEntry[];
  entryCount: number;
  truncated: boolean;
};

export type WeightTrendPoint = {
  id: string;
  measuredAt: string;
  localDate: string;
  weightKg: number;
  previousWeightKg: number | null;
  changeFromPreviousKg: number | null;
  daysSincePrevious: number | null;
};

export type WeightTrend = {
  points: WeightTrendPoint[];
  truncated: boolean;
};

export type ProgressSummary = {
  startDate: string;
  endDate: string;
  rangeDays: number;
  loggedDays: number;
  totalEntries: number;
  averageDailyCalories: number | null;
  completeMacroDays: number;
  averageDailyProteinG: number | null;
  averageDailyCarbohydratesG: number | null;
  averageDailyFatG: number | null;
  firstWeightDate: string | null;
  firstWeightKg: number | null;
  latestWeightDate: string | null;
  latestWeightKg: number | null;
  weightChangeKg: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbohydrateTargetG: number | null;
  fatTargetG: number | null;
  serverCalculatedAt: string;
};

export type HistoryEditPreviewInput = {
  entry: HistoryDayEntry;
  mealType: MealType;
  consumedAt: string;
  originalDescription: string;
};

export type OAuthConsentClient = {
  id: string;
  name: string;
  uri: string;
  logoUri: string;
};

export type OAuthConsentDetails = {
  kind: "consent";
  authorizationId: string;
  redirectUri: string;
  client: OAuthConsentClient;
  userId: string;
  userEmail: string;
  requestedScope: string;
  supportedScopes: ("openid" | "email" | "profile" | "phone")[];
  unsupportedScopes: string[];
  approvalBlockedReasons: string[];
};

export type OAuthConsentLookup =
  OAuthConsentDetails | { kind: "redirect"; redirectUrl: string };

export interface MobileApi {
  getSession(): Promise<Session | null>;
  getOAuthConsentDetails(authorizationId: string): Promise<OAuthConsentLookup>;
  approveOAuthAuthorization(details: OAuthConsentDetails): Promise<string>;
  denyOAuthAuthorization(details: OAuthConsentDetails): Promise<string>;
  onAuthStateChange(listener: (session: Session | null) => void): () => void;
  login(email: string, password: string): Promise<void>;
  register(
    email: string,
    password: string,
  ): Promise<{ needsVerification: boolean }>;
  resendVerification(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  logout(): Promise<void>;
  upsertProfile(input: ProfileInput): Promise<void>;
  getGoalSetup(): Promise<GoalSetup>;
  proposeNutritionTarget(input: ProfileInput): Promise<NutritionTarget>;
  getProposedNutritionTarget(): Promise<NutritionTarget | null>;
  confirmNutritionTarget(targetId: string): Promise<NutritionTarget>;
  createManualFoodPreview(input: ManualFoodInput): Promise<FoodPreview>;
  lookupBarcode(barcode: string): Promise<BarcodeLookup>;
  createBarcodePreview(input: BarcodePreviewInput): Promise<FoodPreview>;
  confirmFoodPreview(
    previewId: string,
    revision: number,
    idempotencyKey: string,
  ): Promise<{ entryId: string; reused: boolean }>;
  getTodaySummary(): Promise<TodaySummary>;
  getCalendarHistory(
    startDate: string,
    endDate: string,
  ): Promise<CalendarHistoryDay[]>;
  getDayHistory(localDate: string): Promise<DayHistory>;
  getWeightTrend(startDate: string, endDate: string): Promise<WeightTrend>;
  getProgressSummary(
    startDate: string,
    endDate: string,
  ): Promise<ProgressSummary>;
  copyFoodEntryToPreview(
    entryId: string,
    mealType: MealType,
    consumedAt: string,
  ): Promise<FoodPreview>;
  createFoodEntryEditPreview(
    input: HistoryEditPreviewInput,
  ): Promise<FoodPreview>;
  listSavedFoods(): Promise<SavedFood[]>;
  saveFoodForReuse(input: ManualFoodInput): Promise<SavedFood>;
  deleteFoodEntry(entryId: string): Promise<void>;
  recordWeight(
    weightKg: number,
    measuredAt: string,
    idempotencyKey: string,
  ): Promise<WeightLog>;
  listWeightLogs(): Promise<WeightLog[]>;
}
