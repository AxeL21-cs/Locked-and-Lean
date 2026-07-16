import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../src/components/ActionButton";
import { AsyncStatePanel } from "../../src/components/AsyncStatePanel";
import { BrandMark } from "../../src/components/BrandMark";
import { MacroRail } from "../../src/components/MacroRail";
import { Screen } from "../../src/components/Screen";
import type { AppTheme } from "../../src/design-system/theme";
import { useAppTheme } from "../../src/design-system/theme";
import {
  mobileApi,
  type FoodEntry,
  type MealType,
  type TodaySummary,
} from "../../src/services/supabase";
import { useSession } from "../../src/features/auth/SessionProvider";
import {
  cacheKeys,
  getCache,
  putCache,
} from "../../src/features/offline/offlineStore";
import { SyncStatusBanner } from "../../src/features/offline/SyncStatusBanner";

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};
export default function TodayScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { session } = useSession();
  const ownerId = session?.user.id;
  const client = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<FoodEntry | null>(null);
  const [cachedSummary, setCachedSummary] = useState<TodaySummary>();
  const [showingCached, setShowingCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string>();
  useEffect(() => {
    if (ownerId)
      void getCache<TodaySummary>(ownerId, cacheKeys.today).then((cached) => {
        setCachedSummary(cached?.value);
        setCachedAt(cached?.updatedAt);
      });
  }, [ownerId]);
  const query = useQuery({
    queryKey: ["today", ownerId],
    enabled: Boolean(ownerId),
    queryFn: async () => {
      try {
        const value = await mobileApi.getTodaySummary();
        await putCache(ownerId!, cacheKeys.today, value);
        setCachedSummary(value);
        setShowingCached(false);
        return value;
      } catch (error) {
        const cached = await getCache<TodaySummary>(ownerId!, cacheKeys.today);
        if (cached) {
          setShowingCached(true);
          setCachedAt(cached.updatedAt);
          return cached.value;
        }
        throw error;
      }
    },
  });
  const remove = useMutation({
    mutationFn: (entryId: string) => mobileApi.deleteFoodEntry(entryId),
    onSuccess: async () => {
      setPendingDelete(null);
      await client.invalidateQueries({ queryKey: ["today"] });
    },
  });
  if (query.isLoading)
    return (
      <Screen>
        <TodayLoadingState cached={cachedSummary} />
      </Screen>
    );
  if (query.error)
    return (
      <Screen>
        <AsyncStatePanel
          actionLabel="Retry"
          kind={
            query.error.message.toLowerCase().includes("offline")
              ? "offline"
              : "error"
          }
          message={query.error.message}
          onAction={() => query.refetch()}
          title="Today is unavailable"
        />
      </Screen>
    );
  const summary = query.data!;
  const target = summary.calorieTarget;
  const remaining = target == null ? null : target - summary.caloriesConsumed;
  return (
    <Screen>
      <View style={styles.masthead}>
        <View style={styles.mastheadBrand}>
          <BrandMark decorative showWordmark size={44} />
          <Text style={styles.kicker}>
            {summary.localDate} · MANILA PERFORMANCE LOG
          </Text>
        </View>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {showingCached ? "SAVED COPY" : "CONFIRMED"}
          </Text>
        </View>
      </View>
      <SyncStatusBanner />
      {showingCached ? (
        <Text accessibilityRole="alert" style={styles.cachedNotice}>
          Offline saved copy · last cached {cachedAt ?? summary.lastUpdatedAt}.
          Refresh after reconnecting for current server records.
        </Text>
      ) : null}
      <View
        style={styles.energyCard}
        accessible
        accessibilityLabel={
          remaining == null
            ? `${summary.caloriesConsumed} calories consumed; no active target`
            : `${remaining} calories remaining`
        }
      >
        <View style={styles.accentBar} />
        <Text style={styles.cardEyebrow}>
          {target == null ? "NO ACTIVE TARGET" : "TODAY’S BALANCE"}
        </Text>
        <Text style={styles.remaining}>
          {remaining == null
            ? Math.round(summary.caloriesConsumed).toLocaleString()
            : Math.round(remaining).toLocaleString()}
        </Text>
        <Text style={styles.remainingLabel}>
          {target == null ? "KCAL CONSUMED" : "KCAL REMAINING"}
        </Text>
        {target == null ? (
          <ActionButton
            label="Set targets"
            onPress={() => router.push("/onboarding" as Href)}
            tone="secondary"
          />
        ) : (
          <>
            <MacroRail
              label="Energy"
              value={summary.caloriesConsumed}
              target={target}
              unit="kcal"
            />
            <View style={styles.macroGrid}>
              <MacroRail
                compact
                label="Protein"
                value={summary.proteinConsumedG}
                target={summary.proteinTargetG ?? 1}
                unit="g"
              />
              <MacroRail
                compact
                label="Carbs"
                value={summary.carbohydratesConsumedG}
                target={summary.carbohydrateTargetG ?? 1}
                unit="g"
              />
              <MacroRail
                compact
                label="Fat"
                value={summary.fatConsumedG}
                target={summary.fatTargetG ?? 1}
                unit="g"
              />
            </View>
          </>
        )}
      </View>
      {summary.entries.length === 0 ? (
        <AsyncStatePanel
          actionLabel="Add food"
          kind="empty"
          message="Create a complete preview, review it, then explicitly confirm it to start today’s record."
          onAction={() => router.push("/manual-entry" as Href)}
          title="No confirmed food yet"
        />
      ) : null}
      {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((meal) => {
        const entries = summary.entries.filter(
          (entry) => entry.mealType === meal,
        );
        return (
          <View key={meal} style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{mealLabels[meal]}</Text>
              <Text style={styles.sectionCount}>
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </Text>
            </View>
            {entries.length === 0 ? (
              <Text style={styles.emptyMeal}>No confirmed entries</Text>
            ) : (
              entries.map((entry) => (
                <View key={entry.id} style={styles.entry}>
                  <View style={styles.entryTop}>
                    <View style={styles.entryCopy}>
                      <Text style={styles.entryName}>{entry.name}</Text>
                      <Text style={styles.entryMeta}>
                        {entry.serving} · {entry.source}
                      </Text>
                      <Text style={styles.entryStatus}>
                        {entry.estimated ? "ESTIMATED" : "RECORDED"} ·{" "}
                        {entry.confidence == null
                          ? "confidence not provided"
                          : `${Math.round(entry.confidence * 100)}% confidence`}
                      </Text>
                    </View>
                    <Text style={styles.entryKcal}>
                      {Math.round(entry.calories)}
                      <Text style={styles.entryUnit}> kcal</Text>
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${entry.name} through a new preview`}
                      android_ripple={{ color: theme.colors.brandContainer }}
                      onPress={() =>
                        router.push({
                          pathname: "/manual-entry",
                          params: {
                            name: entry.name,
                            calories: String(entry.calories),
                            meal: entry.mealType,
                          },
                        } as unknown as Href)
                      }
                      style={styles.smallAction}
                    >
                      <Text style={styles.smallText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Copy ${entry.name} as a new preview`}
                      android_ripple={{ color: theme.colors.brandContainer }}
                      onPress={() =>
                        router.push({
                          pathname: "/manual-entry",
                          params: {
                            name: entry.name,
                            calories: String(entry.calories),
                            meal: entry.mealType,
                            copy: "entry",
                          },
                        } as unknown as Href)
                      }
                      style={styles.smallAction}
                    >
                      <Text style={styles.smallText}>Copy</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${entry.name}`}
                      android_ripple={{ color: theme.colors.dangerContainer }}
                      onPress={() => setPendingDelete(entry)}
                      style={styles.smallAction}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        );
      })}
      {pendingDelete ? (
        <View accessibilityRole="alert" style={styles.deletePanel}>
          <Text style={styles.deleteTitle}>Delete “{pendingDelete.name}”?</Text>
          <Text style={styles.deleteCopy}>
            This removes the confirmed entry and asks the server to recalculate
            the day. This cannot be undone.
          </Text>
          {remove.error ? (
            <Text style={styles.deleteError}>{remove.error.message}</Text>
          ) : null}
          <ActionButton
            busy={remove.isPending}
            label="Confirm delete"
            onPress={() => remove.mutate(pendingDelete.id)}
            tone="danger"
          />
          <ActionButton
            disabled={remove.isPending}
            label="Keep entry"
            onPress={() => setPendingDelete(null)}
            tone="secondary"
          />
        </View>
      ) : null}
      <Text style={styles.updated}>
        Last server update: {summary.lastUpdatedAt}. Pull-to-refresh is
        available through the screen retry states.
      </Text>
    </Screen>
  );
}

function TodayLoadingState({ cached }: { cached?: TodaySummary }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const target = cached?.calorieTarget;
  const consumed = cached?.caloriesConsumed ?? 0;
  const remaining = target == null ? null : target - consumed;
  return (
    <View accessibilityLiveRegion="polite">
      <Text style={styles.loadingEyebrow}>TODAY · RESTORING RECORD</Text>
      <Text style={styles.loadingTitle}>
        {remaining == null
          ? "Your daily field log"
          : `${Math.round(remaining).toLocaleString()} kcal left`}
      </Text>
      <Text style={styles.loadingCopy}>
        {cached
          ? "Showing saved totals while fresh records load."
          : "Your target and macro rails will appear here. Confirmed entries are never guessed."}
      </Text>
      <View style={styles.loadingStats}>
        <View style={styles.loadingStat}>
          <Text style={styles.loadingValue}>{Math.round(consumed)}</Text>
          <Text style={styles.loadingLabel}>CONSUMED</Text>
        </View>
        <View style={styles.loadingStat}>
          <Text style={styles.loadingValue}>
            {target == null ? "—" : Math.round(target)}
          </Text>
          <Text style={styles.loadingLabel}>DAILY LIMIT</Text>
        </View>
        <View style={styles.loadingStat}>
          <Text style={styles.loadingValue}>
            {cached ? Math.round(cached.proteinConsumedG) : "—"}
          </Text>
          <Text style={styles.loadingLabel}>PROTEIN G</Text>
        </View>
      </View>
      <View
        accessible
        accessibilityLabel="Loading current records"
        style={styles.skeleton}
      >
        <View style={styles.skeletonWide} />
        <View style={styles.skeletonShort} />
        <View style={styles.skeletonWide} />
      </View>
    </View>
  );
}

const createStyles = ({
  colors,
  elevation,
  isDark,
  radius,
  spacing,
  type,
  typeScale,
}: AppTheme) =>
  StyleSheet.create({
    masthead: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "space-between",
      paddingTop: spacing.md,
    },
    mastheadBrand: { flex: 1, minWidth: 0 },
    kicker: {
      color: colors.textFaint,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.7,
      lineHeight: 17,
      marginTop: 2,
    },
    live: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 36,
      paddingHorizontal: 10,
    },
    liveDot: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    liveText: {
      color: colors.textMuted,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 0.6,
    },
    energyCard: {
      backgroundColor: isDark ? colors.surfaceRaised : colors.text,
      borderRadius: radius.xl,
      marginTop: spacing.xl,
      overflow: "hidden",
      padding: 24,
      ...elevation.floating,
    },
    accentBar: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      height: 5,
      marginBottom: spacing.lg,
      width: 48,
    },
    cardEyebrow: {
      color: colors.brand,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1,
    },
    remaining: {
      color: isDark ? colors.text : colors.background,
      fontFamily: type.numeric,
      fontSize: typeScale.hero,
      letterSpacing: -2.5,
      lineHeight: 64,
      marginTop: spacing.sm,
    },
    remainingLabel: {
      color: colors.brand,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1.1,
      marginBottom: spacing.xl,
    },
    macroGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    section: { marginTop: spacing.xl },
    sectionHead: {
      alignItems: "flex-end",
      borderBottomColor: colors.borderStrong,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 22,
    },
    sectionCount: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
    },
    emptyMeal: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      paddingVertical: spacing.md,
    },
    entry: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: 10,
      padding: 16,
      ...elevation.card,
    },
    entryTop: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    entryCopy: { flex: 1 },
    entryName: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: 16,
    },
    entryMeta: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.label,
      lineHeight: 18,
      marginTop: 3,
    },
    entryStatus: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    entryKcal: { color: colors.text, fontFamily: type.numeric, fontSize: 18 },
    entryUnit: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    smallAction: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      minWidth: 68,
      paddingHorizontal: spacing.md,
    },
    smallText: { color: colors.text, fontFamily: type.label, fontSize: 13 },
    deleteText: { color: colors.danger, fontFamily: type.label, fontSize: 13 },
    deletePanel: {
      backgroundColor: colors.dangerContainer,
      borderColor: colors.danger,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    deleteTitle: { color: colors.text, fontFamily: type.display, fontSize: 23 },
    deleteCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 13,
      lineHeight: 19,
      marginTop: spacing.xs,
    },
    deleteError: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      marginTop: spacing.md,
    },
    updated: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginBottom: spacing.xl,
      marginTop: spacing.xl,
    },
    loadingEyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1,
      marginTop: spacing.xl,
    },
    loadingTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 34,
      marginTop: spacing.sm,
    },
    loadingCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 14,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    loadingStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    loadingStat: {
      backgroundColor: isDark ? colors.surfaceRaised : colors.text,
      borderRadius: radius.md,
      flex: 1,
      minWidth: 92,
      minHeight: 88,
      padding: spacing.md,
    },
    loadingValue: {
      color: isDark ? colors.text : colors.background,
      fontFamily: type.numeric,
      fontSize: 22,
    },
    loadingLabel: {
      color: colors.brand,
      fontFamily: type.label,
      fontSize: 10,
      marginTop: spacing.sm,
    },
    skeleton: { gap: spacing.md, marginTop: spacing.xl },
    skeletonWide: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      height: 68,
      opacity: 0.65,
    },
    skeletonShort: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      height: 20,
      opacity: 0.45,
      width: "55%",
    },
    cachedNotice: {
      backgroundColor: colors.brandContainer,
      borderRadius: radius.md,
      color: colors.textMuted,
      fontFamily: type.bodyStrong,
      fontSize: 12,
      lineHeight: 18,
      marginTop: spacing.md,
      padding: spacing.md,
    },
  });
