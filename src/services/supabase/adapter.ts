import * as Linking from "expo-linking";

import { PRODUCT } from "../../design-system/product";
import { getOAuthConsentReadiness } from "../../config/environment";
import {
  isSafeServerRedirect,
  normalizeAuthorizationId,
  splitRequestedScopes,
} from "../../features/oauth/authorization";
import { localDateInManila } from "../../domain/localization/philippines";
import { getSupabaseClient } from "./client";
import { MobileApiError, toMobileApiError } from "./errors";
import type {
  BarcodeLookup,
  CalendarHistoryDay,
  DayHistory,
  FoodPreview,
  HistoryDayEntry,
  ManualFoodInput,
  MobileApi,
  NutritionTarget,
  OAuthConsentDetails,
  SavedFood,
  TodaySummary,
  ProgressSummary,
  WeightTrend,
  WeightLog,
} from "./types";

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  if (!value || typeof value !== "object")
    throw new Error("The server returned an invalid response.");
  return value as Row;
}

function first(value: unknown): Row {
  return record(Array.isArray(value) ? value[0] : value);
}

const number = (value: unknown) => Number(value ?? 0);
const nullableNumber = (value: unknown) =>
  value == null ? null : Number(value);
const string = (value: unknown) => String(value ?? "");

function throwIfError(error: unknown) {
  if (error) throw toMobileApiError(error);
}

function birthDateForAge(age: number) {
  const today = new Date();
  const year = today.getUTCFullYear() - age;
  return `${year}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
}

function mapTarget(value: unknown): NutritionTarget {
  const row = first(value);
  const assumptions = row.macro_assumptions;
  return {
    id: string(row.id ?? row.target_id),
    status: string(row.status) === "confirmed" ? "confirmed" : "proposed",
    calorieTarget: number(row.calorie_target),
    proteinTargetG: number(row.protein_target_g),
    carbohydrateTargetG: number(row.carbohydrate_target_g),
    fatTargetG: number(row.fat_target_g),
    formulaName: string(row.formula_name),
    formulaVersion: string(row.formula_version),
    assumptions: Array.isArray(assumptions)
      ? assumptions.map(String)
      : assumptions && typeof assumptions === "object"
        ? Object.entries(assumptions).map(
            ([key, item]) => `${key}: ${String(item)}`,
          )
        : [],
    disclaimer: string(
      row.informational_disclaimer ??
        row.informational_disclaimer_version ??
        "Informational estimate for adults; not medical advice.",
    ),
  };
}

function mapPreview(value: unknown, fallback?: ManualFoodInput): FoodPreview {
  const row = first(value);
  const rawItems = Array.isArray(row.items) ? row.items : [];
  return {
    id: string(row.preview_id ?? row.id),
    revision: number(row.revision_number ?? row.revision),
    mealType: string(row.meal_type) as FoodPreview["mealType"],
    consumedAt: string(row.consumed_at),
    expiresAt: string(row.expires_at),
    totalCalories: number(row.total_calories),
    totalProteinG: nullableNumber(row.total_protein_g),
    totalCarbohydratesG: nullableNumber(row.total_carbohydrates_g),
    totalFatG: nullableNumber(row.total_fat_g),
    items: (rawItems.length
      ? rawItems
      : fallback
        ? [
            {
              id: `manual-${string(row.preview_id ?? row.id)}`,
              food_name: fallback.foodName,
              brand_name: fallback.brand,
              serving_description: `${fallback.quantity} ${fallback.servingUnit}`,
              calories: fallback.calories,
              protein_g: fallback.proteinG ?? null,
              carbohydrates_g: fallback.carbohydratesG ?? null,
              fat_g: fallback.fatG ?? null,
              is_estimated: false,
              confidence: 1,
              provider: "Manual entry",
              uncertainty: [],
            },
          ]
        : row.food_name
          ? [
              {
                id: `barcode-${string(row.preview_id ?? row.id)}`,
                food_name: row.food_name,
                brand_name: row.brand_name,
                serving_description:
                  row.serving_description ??
                  `${string(row.serving_count)} ${string(row.serving_unit)}`,
                calories: row.total_calories,
                protein_g: row.total_protein_g,
                carbohydrates_g: row.total_carbohydrates_g,
                fat_g: row.total_fat_g,
                is_estimated: row.is_estimated,
                confidence: row.confidence,
                provider: row.provider,
                uncertainty: [
                  ...(Array.isArray(row.uncertainty)
                    ? row.uncertainty.map(String)
                    : []),
                  ...[row.market_warning, row.source_warning]
                    .filter(Boolean)
                    .map(String),
                ],
              },
            ]
          : []
    ).map((itemValue) => {
      const item = record(itemValue);
      return {
        id: string(item.id ?? item.preview_item_id),
        foodName: string(item.food_name),
        brand: item.brand_name ? string(item.brand_name) : undefined,
        servingDescription: string(
          item.serving_description ??
            `${string(item.quantity)} ${string(item.unit)}`,
        ),
        calories: number(item.calories),
        proteinG: nullableNumber(item.protein_g),
        carbohydratesG: nullableNumber(item.carbohydrates_g),
        fatG: nullableNumber(item.fat_g),
        estimated: Boolean(item.is_estimated),
        confidence: nullableNumber(item.confidence),
        source: string(item.provider ?? "Manual entry"),
        uncertainty: Array.isArray(item.uncertainty)
          ? item.uncertainty.map(String)
          : [],
      };
    }),
  };
}

function warningList(row: Row) {
  return [
    row.market_warning,
    row.source_warning,
    ...(Array.isArray(row.uncertainty) ? row.uncertainty : []),
  ]
    .filter(Boolean)
    .map(String);
}

function mapBarcodeLookup(value: unknown): BarcodeLookup {
  const rows = (Array.isArray(value) ? value : [value]).map(record);
  const header = rows[0];
  if (!header) throw new Error("The server returned no barcode lookup state.");
  const scanSessionId = string(header.scan_session_id);
  const barcode = string(header.canonical_barcode);
  if (string(header.lookup_status) !== "found") {
    return {
      status: "unknown",
      scanSessionId,
      barcode,
      warnings: [...new Set(rows.flatMap(warningList))],
    };
  }
  return {
    status: "found",
    scanSessionId,
    barcode,
    warnings: [],
    candidates: rows
      .filter((row) => row.food_product_id)
      .map((row) => ({
        productId: string(row.food_product_id),
        servingId: row.serving_id ? string(row.serving_id) : null,
        name: string(row.canonical_name),
        brand: row.brand_name ? string(row.brand_name) : undefined,
        servingLabel: string(row.serving_description ?? "1 serving"),
        caloriesPerServing: number(row.calories),
        proteinGPerServing: nullableNumber(row.protein_g),
        carbohydratesGPerServing: nullableNumber(row.carbohydrates_g),
        fatGPerServing: nullableNumber(row.fat_g),
        providerName: string(row.provider || "Catalog source").replace(
          /_/g,
          " ",
        ),
        sourceAttribution: row.attribution
          ? string(row.attribution)
          : undefined,
        marketStatus:
          string(row.market_status) === "PH"
            ? ("PH" as const)
            : string(row.market_status) === "foreign"
              ? ("foreign" as const)
              : ("unknown" as const),
        warnings: [...new Set(warningList(row))],
      })),
  };
}

function mapOwnedPreview(value: unknown): FoodPreview {
  return mapPreview(value);
}

function mapHistoryItem(value: unknown) {
  const item = record(value);
  return {
    id: string(item.id),
    foodProductId: item.food_product_id ? string(item.food_product_id) : null,
    foodName: string(item.food_name),
    brand: item.brand_name ? string(item.brand_name) : undefined,
    quantity: number(item.quantity),
    unit: string(item.unit),
    calories: number(item.calories),
    proteinG: nullableNumber(item.protein_g),
    carbohydratesG: nullableNumber(item.carbohydrates_g),
    fatG: nullableNumber(item.fat_g),
    provider: string(item.provider),
    providerIdentifier: item.provider_identifier
      ? string(item.provider_identifier)
      : null,
    providerVersion: item.provider_version
      ? string(item.provider_version)
      : null,
    providerRetrievedAt: item.provider_retrieved_at
      ? string(item.provider_retrieved_at)
      : null,
    attribution: item.attribution ? string(item.attribution) : undefined,
    marketCountryCode: item.market_country_code
      ? string(item.market_country_code)
      : null,
    estimated: Boolean(item.is_estimated),
    confidence: nullableNumber(item.confidence),
    uncertainty: Array.isArray(item.uncertainty)
      ? item.uncertainty.map(String)
      : [],
  };
}

async function rpc(name: string, args: Row) {
  try {
    const response = await getSupabaseClient().rpc(name, args);
    throwIfError(response.error);
    return response.data;
  } catch (error) {
    throw toMobileApiError(error);
  }
}

function assertOAuthConsentReady() {
  const readiness = getOAuthConsentReadiness();
  if (!readiness.enabled)
    throw new MobileApiError(readiness.reason, "configuration");
}

async function getFreshOAuthUser() {
  const { data, error } = await getSupabaseClient().auth.getUser();
  throwIfError(error);
  if (!data.user)
    throw new MobileApiError(
      "A fresh authenticated session is required for OAuth consent.",
      "authentication",
    );
  return data.user;
}

function assertOAuthUser(details: OAuthConsentDetails, userId: string) {
  if (details.userId !== userId)
    throw new MobileApiError(
      "The OAuth request belongs to a different authenticated user.",
      "authentication",
    );
}

export const mobileApi: MobileApi = {
  async getSession() {
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      throwIfError(error);
      return data.session;
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  onAuthStateChange(listener) {
    try {
      const { data } = getSupabaseClient().auth.onAuthStateChange(
        (_event, session) => listener(session),
      );
      return () => data.subscription.unsubscribe();
    } catch {
      return () => undefined;
    }
  },
  async getOAuthConsentDetails(authorizationId) {
    try {
      assertOAuthConsentReady();
      const normalizedId = normalizeAuthorizationId(authorizationId);
      if (!normalizedId)
        throw new MobileApiError(
          "The OAuth authorization_id is missing or invalid.",
          "validation",
        );
      const user = await getFreshOAuthUser();
      const { data, error } =
        await getSupabaseClient().auth.oauth.getAuthorizationDetails(
          normalizedId,
        );
      throwIfError(error);
      if (!data)
        throw new MobileApiError(
          "The OAuth authorization request is unavailable or expired.",
          "validation",
        );
      if ("redirect_url" in data) {
        if (!isSafeServerRedirect(data.redirect_url))
          throw new MobileApiError(
            "The OAuth server returned an unsafe redirect.",
            "validation",
          );
        return { kind: "redirect", redirectUrl: data.redirect_url };
      }
      if (data.authorization_id !== normalizedId)
        throw new MobileApiError(
          "The OAuth server returned a different authorization request.",
          "validation",
        );
      if (data.user.id !== user.id)
        throw new MobileApiError(
          "The OAuth request does not match the freshly authenticated user.",
          "authentication",
        );
      const scopes = splitRequestedScopes(data.scope);
      const approvalBlockedReasons = [
        ...(scopes.unsupported.length
          ? [
              `Unsupported OAuth scopes requested: ${scopes.unsupported.join(", ")}.`,
            ]
          : []),
        ...(!isSafeServerRedirect(data.redirect_uri)
          ? [
              "The registered redirect URI is not an approved HTTPS destination.",
            ]
          : []),
      ];
      return {
        kind: "consent",
        authorizationId: normalizedId,
        redirectUri: data.redirect_uri,
        client: {
          id: data.client.id,
          name: data.client.name,
          uri: data.client.uri,
          logoUri: data.client.logo_uri,
        },
        userId: user.id,
        userEmail: data.user.email,
        requestedScope: data.scope,
        supportedScopes: scopes.supported,
        unsupportedScopes: scopes.unsupported,
        approvalBlockedReasons,
      };
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async approveOAuthAuthorization(details) {
    try {
      assertOAuthConsentReady();
      if (details.approvalBlockedReasons.length)
        throw new MobileApiError(
          "This OAuth request cannot be approved safely.",
          "validation",
        );
      const user = await getFreshOAuthUser();
      assertOAuthUser(details, user.id);
      const { data, error } =
        await getSupabaseClient().auth.oauth.approveAuthorization(
          details.authorizationId,
          { skipBrowserRedirect: true },
        );
      throwIfError(error);
      if (
        !data?.redirect_url ||
        !isSafeServerRedirect(data.redirect_url, details.redirectUri)
      )
        throw new MobileApiError(
          "The OAuth server returned an unsafe approval redirect.",
          "validation",
        );
      return data.redirect_url;
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async denyOAuthAuthorization(details) {
    try {
      assertOAuthConsentReady();
      const user = await getFreshOAuthUser();
      assertOAuthUser(details, user.id);
      const { data, error } =
        await getSupabaseClient().auth.oauth.denyAuthorization(
          details.authorizationId,
          { skipBrowserRedirect: true },
        );
      throwIfError(error);
      if (
        !data?.redirect_url ||
        !isSafeServerRedirect(data.redirect_url, details.redirectUri)
      )
        throw new MobileApiError(
          "The OAuth server returned an unsafe denial redirect.",
          "validation",
        );
      return data.redirect_url;
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async login(email, password) {
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      throwIfError(error);
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async register(email, password) {
    try {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: Linking.createURL("/") },
      });
      throwIfError(error);
      return { needsVerification: !data.session };
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async resendVerification(email) {
    try {
      const { error } = await getSupabaseClient().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: Linking.createURL("/") },
      });
      throwIfError(error);
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async requestPasswordReset(email) {
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
        email,
        {
          redirectTo: Linking.createURL("/update-password"),
        },
      );
      throwIfError(error);
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async updatePassword(password) {
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      throwIfError(error);
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async logout() {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      throwIfError(error);
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async upsertProfile(input) {
    await rpc("upsert_profile", {
      p_display_name: input.displayName,
      p_birth_date: birthDateForAge(input.ageYears),
      p_formula_sex: input.formulaSex,
      p_height_cm: input.heightCm,
      p_preferred_units: input.preferredUnits,
      p_time_zone: input.timezone,
    });
  },
  async proposeNutritionTarget(input) {
    const data = await rpc("propose_nutrition_target", {
      p_weight_kg: input.weightKg,
      p_activity_level: input.activityLevel,
      p_goal: input.goal,
      p_requested_weekly_weight_change_kg: input.targetRateKgPerWeek ?? null,
      p_effective_from: null,
    });
    return mapTarget(data);
  },
  async getProposedNutritionTarget() {
    try {
      const { data, error } = await getSupabaseClient()
        .from("nutrition_targets")
        .select("*")
        .eq("status", "proposed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      throwIfError(error);
      return data ? mapTarget(data) : null;
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async confirmNutritionTarget(targetId) {
    return mapTarget(
      await rpc("confirm_nutrition_target", {
        p_target_id: targetId,
        p_confirmation: true,
      }),
    );
  },
  async createManualFoodPreview(input) {
    const item: Row = {
      food_name: input.foodName,
      brand_name: input.brand ?? null,
      quantity: input.quantity,
      unit: input.servingUnit,
      calories: input.calories,
      provider: "user_manual",
      is_estimated: false,
      confidence: 1,
      uncertainty: [],
    };
    if (input.proteinG != null) item.protein_g = input.proteinG;
    if (input.carbohydratesG != null)
      item.carbohydrates_g = input.carbohydratesG;
    if (input.fatG != null) item.fat_g = input.fatG;
    const consumedAt = `${input.consumedDate}T${input.consumedTime}:00+08:00`;
    return mapPreview(
      await rpc("create_manual_food_log_preview", {
        p_meal_type: input.mealType,
        p_consumed_at: consumedAt,
        p_time_zone: PRODUCT.timezone,
        p_original_description: input.brand
          ? `${input.brand} ${input.foodName}`
          : input.foodName,
        p_items: [item],
      }),
      input,
    );
  },
  async lookupBarcode(barcode) {
    return mapBarcodeLookup(
      await rpc("lookup_barcode_candidates", {
        p_barcode: barcode,
        p_market_country_code: "PH",
      }),
    );
  },
  async createBarcodePreview(input) {
    return mapPreview(
      await rpc("create_barcode_food_log_preview", {
        p_scan_session_id: input.scanSessionId,
        p_food_product_id: input.foodProductId,
        p_serving_id: input.servingId,
        p_serving_count: input.servingCount,
        p_meal_type: input.mealType,
        p_consumed_at: input.consumedAt,
        p_time_zone: PRODUCT.timezone,
        p_original_description: input.originalDescription,
      }),
    );
  },
  async confirmFoodPreview(previewId, revision, idempotencyKey) {
    const row = first(
      await rpc("confirm_food_log", {
        p_preview_id: previewId,
        p_confirmed_revision: revision,
        p_confirmation: true,
        p_idempotency_key: idempotencyKey,
      }),
    );
    return { entryId: string(row.entry_id), reused: Boolean(row.reused) };
  },
  async getTodaySummary() {
    try {
      const localDate = localDateInManila(new Date());
      const client = getSupabaseClient();
      const [summaryResponse, entriesResponse] = await Promise.all([
        client
          .from("daily_summaries")
          .select("*")
          .eq("local_date", localDate)
          .maybeSingle(),
        client
          .from("food_entries")
          .select("*, food_entry_items(*)")
          .eq("local_date", localDate)
          .is("deleted_at", null)
          .order("consumed_at", { ascending: true }),
      ]);
      throwIfError(summaryResponse.error);
      throwIfError(entriesResponse.error);
      const summary = summaryResponse.data as Row | null;
      const entries = (entriesResponse.data ?? []) as Row[];
      return {
        localDate,
        calorieTarget: nullableNumber(summary?.calorie_target),
        proteinTargetG: nullableNumber(summary?.protein_target_g),
        carbohydrateTargetG: nullableNumber(summary?.carbohydrate_target_g),
        fatTargetG: nullableNumber(summary?.fat_target_g),
        caloriesConsumed: number(summary?.consumed_calories),
        proteinConsumedG: number(summary?.consumed_protein_g),
        carbohydratesConsumedG: number(summary?.consumed_carbohydrates_g),
        fatConsumedG: number(summary?.consumed_fat_g),
        entries: entries.map((entry) => {
          const items = Array.isArray(entry.food_entry_items)
            ? entry.food_entry_items.map(record)
            : [];
          const primary = items[0];
          return {
            id: string(entry.id),
            mealType: string(
              entry.meal_type,
            ) as TodaySummary["entries"][number]["mealType"],
            consumedAt: string(entry.consumed_at),
            name: primary ? string(primary.food_name) : "Food entry",
            serving: primary
              ? `${string(primary.quantity)} ${string(primary.unit)}`
              : `${items.length} items`,
            calories: number(entry.total_calories),
            proteinG: number(entry.total_protein_g),
            carbohydratesG: number(entry.total_carbohydrates_g),
            fatG: number(entry.total_fat_g),
            source: string(
              primary?.provider ?? entry.source_kind ?? "Confirmed entry",
            ),
            estimated: items.some((item) => Boolean(item.is_estimated)),
            confidence: nullableNumber(primary?.confidence),
          };
        }),
        lastUpdatedAt: string(summary?.updated_at ?? new Date().toISOString()),
      };
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async getCalendarHistory(startDate, endDate) {
    const rows = (await rpc("get_calendar_history", {
      p_start_date: startDate,
      p_end_date: endDate,
    })) as unknown[];
    return (rows ?? []).map((value): CalendarHistoryDay => {
      const row = record(value);
      return {
        localDate: string(row.local_date),
        entryCount: number(row.entry_count),
        calories: number(row.consumed_calories),
        proteinG: nullableNumber(row.consumed_protein_g),
        carbohydratesG: nullableNumber(row.consumed_carbohydrates_g),
        fatG: nullableNumber(row.consumed_fat_g),
        macroDataComplete: Boolean(row.macro_data_complete),
        calorieTarget: nullableNumber(row.calorie_target),
        proteinTargetG: nullableNumber(row.protein_target_g),
        carbohydrateTargetG: nullableNumber(row.carbohydrate_target_g),
        fatTargetG: nullableNumber(row.fat_target_g),
        weightKg: nullableNumber(row.weight_kg),
        hasEntries: Boolean(row.has_entries),
        serverCalculatedAt: string(row.server_calculated_at),
      };
    });
  },
  async getDayHistory(localDate) {
    const rows = ((await rpc("get_day_history", {
      p_local_date: localDate,
    })) ?? []) as unknown[];
    const entries = rows.map((value): HistoryDayEntry => {
      const row = record(value);
      return {
        id: string(row.entry_id),
        sourceKind: string(row.source_kind),
        mealType: string(row.meal_type) as HistoryDayEntry["mealType"],
        consumedAt: string(row.consumed_at),
        localDate: string(row.local_date),
        originalDescription: string(row.original_description),
        calories: number(row.total_calories),
        proteinG: nullableNumber(row.total_protein_g),
        carbohydratesG: nullableNumber(row.total_carbohydrates_g),
        fatG: nullableNumber(row.total_fat_g),
        macroDataComplete: Boolean(row.macro_data_complete),
        items: Array.isArray(row.items) ? row.items.map(mapHistoryItem) : [],
      };
    });
    const firstRow = rows[0] ? record(rows[0]) : undefined;
    return {
      localDate,
      entries,
      entryCount: firstRow ? number(firstRow.day_entry_count) : 0,
      truncated: firstRow ? Boolean(firstRow.is_truncated) : false,
    } satisfies DayHistory;
  },
  async getWeightTrend(startDate, endDate) {
    const rows = ((await rpc("get_weight_trend", {
      p_start_date: startDate,
      p_end_date: endDate,
    })) ?? []) as unknown[];
    const firstRow = rows[0] ? record(rows[0]) : undefined;
    return {
      points: rows.map((value) => {
        const row = record(value);
        return {
          id: string(row.weight_log_id),
          measuredAt: string(row.measured_at),
          localDate: string(row.local_date),
          weightKg: number(row.weight_kg),
          previousWeightKg: nullableNumber(row.previous_weight_kg),
          changeFromPreviousKg: nullableNumber(row.change_from_previous_kg),
          daysSincePrevious:
            row.days_since_previous == null
              ? null
              : number(row.days_since_previous),
        };
      }),
      truncated: firstRow ? Boolean(firstRow.is_truncated) : false,
    } satisfies WeightTrend;
  },
  async getProgressSummary(startDate, endDate) {
    const row = first(
      await rpc("get_progress_summary", {
        p_start_date: startDate,
        p_end_date: endDate,
      }),
    );
    return {
      startDate: string(row.start_date),
      endDate: string(row.end_date),
      rangeDays: number(row.range_days),
      loggedDays: number(row.logged_days),
      totalEntries: number(row.total_entries),
      averageDailyCalories: nullableNumber(row.average_daily_calories),
      completeMacroDays: number(row.complete_macro_days),
      averageDailyProteinG: nullableNumber(row.average_daily_protein_g),
      averageDailyCarbohydratesG: nullableNumber(
        row.average_daily_carbohydrates_g,
      ),
      averageDailyFatG: nullableNumber(row.average_daily_fat_g),
      firstWeightDate: row.first_weight_date
        ? string(row.first_weight_date)
        : null,
      firstWeightKg: nullableNumber(row.first_weight_kg),
      latestWeightDate: row.latest_weight_date
        ? string(row.latest_weight_date)
        : null,
      latestWeightKg: nullableNumber(row.latest_weight_kg),
      weightChangeKg: nullableNumber(row.weight_change_kg),
      calorieTarget: nullableNumber(row.calorie_target),
      proteinTargetG: nullableNumber(row.protein_target_g),
      carbohydrateTargetG: nullableNumber(row.carbohydrate_target_g),
      fatTargetG: nullableNumber(row.fat_target_g),
      serverCalculatedAt: string(row.server_calculated_at),
    } satisfies ProgressSummary;
  },
  async copyFoodEntryToPreview(entryId, mealType, consumedAt) {
    return mapOwnedPreview(
      await rpc("copy_food_entry_to_preview", {
        p_entry_id: entryId,
        p_meal_type: mealType,
        p_consumed_at: consumedAt,
      }),
    );
  },
  async createFoodEntryEditPreview(input) {
    return mapOwnedPreview(
      await rpc("create_food_entry_edit_preview", {
        p_entry_id: input.entry.id,
        p_meal_type: input.mealType,
        p_consumed_at: input.consumedAt,
        p_original_description: input.originalDescription,
        p_items: input.entry.items.map((item) => ({
          food_product_id: item.foodProductId,
          food_name: item.foodName,
          brand_name: item.brand ?? null,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          protein_g: item.proteinG,
          carbohydrates_g: item.carbohydratesG,
          fat_g: item.fatG,
          provider: item.provider,
          provider_identifier: item.providerIdentifier,
          provider_version: item.providerVersion,
          provider_retrieved_at: item.providerRetrievedAt,
          attribution: item.attribution ?? null,
          market_country_code: item.marketCountryCode,
          is_estimated: item.estimated,
          confidence: item.confidence,
          uncertainty: item.uncertainty,
        })),
      }),
    );
  },
  async listSavedFoods() {
    try {
      const { data, error } = await getSupabaseClient()
        .from("food_products")
        .select("*")
        .not("user_id", "is", null)
        .order("updated_at", { ascending: false });
      throwIfError(error);
      return ((data ?? []) as Row[]).map((row): SavedFood => ({
        id: string(row.id),
        foodName: string(row.canonical_name),
        brand: row.brand_name ? string(row.brand_name) : undefined,
        serving: `${string(row.serving_quantity)} ${string(row.serving_unit)}`,
        calories: number(row.calories),
        proteinG: number(row.protein_g),
        carbohydratesG: number(row.carbohydrates_g),
        fatG: number(row.fat_g),
      }));
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
  async saveFoodForReuse(input) {
    const row = first(
      await rpc("save_food_for_reuse", {
        p_canonical_name: input.foodName,
        p_brand_name: input.brand ?? null,
        p_barcode: input.barcode ?? null,
        p_serving_quantity: input.quantity,
        p_serving_unit: input.servingUnit,
        p_serving_weight_g: null,
        p_calories: input.calories,
        p_confirmation: true,
        p_protein_g: input.proteinG ?? null,
        p_carbohydrates_g: input.carbohydratesG ?? null,
        p_fat_g: input.fatG ?? null,
      }),
    );
    return {
      id: string(row.food_product_id),
      foodName: string(row.canonical_name),
      brand: row.brand_name ? string(row.brand_name) : undefined,
      serving: `${string(row.serving_quantity)} ${string(row.serving_unit)}`,
      calories: number(row.calories),
      proteinG: number(row.protein_g),
      carbohydratesG: number(row.carbohydrates_g),
      fatG: number(row.fat_g),
    };
  },
  async deleteFoodEntry(entryId) {
    await rpc("delete_food_entry", {
      p_entry_id: entryId,
      p_confirmation: true,
    });
  },
  async recordWeight(weightKg, measuredAt, idempotencyKey) {
    const row = first(
      await rpc("record_weight", {
        p_measured_at: measuredAt,
        p_time_zone: PRODUCT.timezone,
        p_weight_kg: weightKg,
        p_idempotency_key: idempotencyKey,
      }),
    );
    return {
      id: string(row.id ?? row.weight_log_id),
      weightKg: number(row.weight_kg),
      measuredAt: string(row.measured_at),
    };
  },
  async listWeightLogs() {
    try {
      const { data, error } = await getSupabaseClient()
        .from("weight_logs")
        .select("id,weight_kg,measured_at")
        .order("measured_at", { ascending: false })
        .limit(30);
      throwIfError(error);
      return ((data ?? []) as Row[]).map((row): WeightLog => ({
        id: string(row.id),
        weightKg: number(row.weight_kg),
        measuredAt: string(row.measured_at),
      }));
    } catch (error) {
      throw toMobileApiError(error);
    }
  },
};
