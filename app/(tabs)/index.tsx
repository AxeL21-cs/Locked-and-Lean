import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../src/components/ActionButton";
import { AsyncStatePanel } from "../../src/components/AsyncStatePanel";
import { BrandMark } from "../../src/components/BrandMark";
import { Screen } from "../../src/components/Screen";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import type { AppTheme } from "../../src/design-system/theme";
import { useAppTheme } from "../../src/design-system/theme";
import { useSession } from "../../src/features/auth/SessionProvider";
import {
  cacheKeys,
  getCache,
  putCache,
} from "../../src/features/offline/offlineStore";
import { SyncStatusBanner } from "../../src/features/offline/SyncStatusBanner";
import { TodayOverview } from "../../src/features/today/TodayOverview";
import {
  mobileApi,
  type FoodEntry,
  type MealType,
  type TodaySummary,
} from "../../src/services/supabase";

const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
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
    if (!ownerId) return;
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

  const openTargetSetup = () => router.push("/onboarding" as Href);
  const openManualEntry = (meal?: MealType) =>
    router.push(
      meal
        ? ({ pathname: "/manual-entry", params: { meal } } as unknown as Href)
        : ("/manual-entry" as Href),
    );

  if (query.isLoading) {
    return (
      <Screen plain>
        <TodayHeader localDate={cachedSummary?.localDate} status="Refreshing" />
        <TodayLoadingState
          cached={cachedSummary}
          onSetTarget={openTargetSetup}
        />
      </Screen>
    );
  }

  if (query.error) {
    return (
      <Screen plain>
        <TodayHeader status="Unavailable" />
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
  }

  const summary = query.data!;
  const groupedMeals = mealTypes
    .map((meal) => ({
      meal,
      entries: summary.entries.filter((entry) => entry.mealType === meal),
    }))
    .filter(({ entries }) => entries.length > 0);

  return (
    <Screen plain>
      <TodayHeader
        localDate={summary.localDate}
        status={
          showingCached ? "Saved copy" : `${summary.entries.length} confirmed`
        }
      />
      <SyncStatusBanner />

      {showingCached ? (
        <Text accessibilityRole="alert" style={styles.cachedNotice}>
          Offline saved copy · cached {cachedAt ?? summary.lastUpdatedAt}.
          Reconnect to refresh server records.
        </Text>
      ) : null}

      <TodayOverview onSetTarget={openTargetSetup} summary={summary} />

      <View style={styles.mealsHead}>
        <Text accessibilityRole="header" style={styles.mealsTitle}>
          Meals
        </Text>
        <Text style={styles.mealsMeta}>
          {summary.entries.length === 0
            ? "Nothing logged"
            : `${summary.entries.length} confirmed`}
        </Text>
      </View>

      {summary.entries.length === 0 ? (
        <View style={styles.emptyDay}>
          <Text style={styles.emptyTitle}>Your log is clear</Text>
          <Text style={styles.emptyCopy}>
            Add what you ate, check the complete preview, then confirm that
            exact version.
          </Text>
          <Pressable
            accessibilityHint="Opens a new food preview"
            accessibilityLabel="Add food"
            accessibilityRole="button"
            android_ripple={{ color: theme.colors.brandContainer }}
            onPress={() => openManualEntry()}
            style={({ pressed }) => [
              styles.emptyAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.emptyActionText}>Add food</Text>
            <Text accessible={false} style={styles.emptyArrow}>
              →
            </Text>
          </Pressable>
        </View>
      ) : (
        groupedMeals.map(({ meal, entries }) => (
          <MealSection
            entries={entries}
            key={meal}
            meal={meal}
            onCopy={(entry) =>
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
            onDelete={setPendingDelete}
            onEdit={(entry) =>
              router.push({
                pathname: "/manual-entry",
                params: {
                  name: entry.name,
                  calories: String(entry.calories),
                  meal: entry.mealType,
                },
              } as unknown as Href)
            }
          />
        ))
      )}

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

      <Text style={styles.updated}>Updated {summary.lastUpdatedAt}</Text>
    </Screen>
  );
}

function TodayHeader({
  localDate,
  status,
}: {
  localDate?: string;
  status: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <>
      <View style={styles.masthead}>
        <BrandMark
          artworkScale={1.28}
          decorative
          showWordmark
          size={38}
          wordmarkSize={18}
        />
        <ThemeToggle />
      </View>
      <View style={styles.dayHead}>
        <View style={styles.dayCopy}>
          <Text style={styles.dateLabel}>
            {localDate ? formatLocalDate(localDate) : "MANILA · TODAY"}
          </Text>
          <Text accessibilityRole="header" style={styles.dayTitle}>
            Today
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.dayStatus}>
          {status}
        </Text>
      </View>
    </>
  );
}

function TodayLoadingState({
  cached,
  onSetTarget,
}: {
  cached?: TodaySummary;
  onSetTarget: () => void;
}) {
  const styles = createStyles(useAppTheme());
  return (
    <View accessibilityLiveRegion="polite">
      {cached ? (
        <>
          <Text style={styles.refreshingCopy}>
            Showing saved totals while confirmed server records refresh.
          </Text>
          <TodayOverview onSetTarget={onSetTarget} summary={cached} />
        </>
      ) : (
        <View
          accessible
          accessibilityLabel="Loading today's confirmed nutrition totals"
          style={styles.loadingSummary}
        >
          <Text style={styles.loadingLabel}>RESTORING CONFIRMED TOTALS</Text>
          <View style={styles.loadingMetric} />
          <View style={styles.loadingRail} />
          <View style={styles.loadingMacros}>
            <View style={styles.loadingMacro} />
            <View style={styles.loadingMacro} />
            <View style={styles.loadingMacro} />
          </View>
        </View>
      )}
      <View style={styles.loadingMeals}>
        <View style={styles.loadingLineWide} />
        <View style={styles.loadingLine} />
        <View style={styles.loadingLineWide} />
      </View>
    </View>
  );
}

function MealSection({
  entries,
  meal,
  onCopy,
  onDelete,
  onEdit,
}: {
  entries: FoodEntry[];
  meal: MealType;
  onCopy: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
  onEdit: (entry: FoodEntry) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const calories = entries.reduce((total, entry) => total + entry.calories, 0);
  return (
    <View style={styles.mealSection}>
      <View style={styles.mealHead}>
        <Text accessibilityRole="header" style={styles.mealTitle}>
          {mealLabels[meal]}
        </Text>
        <Text style={styles.mealTotal}>
          {entries.length} · {Math.round(calories).toLocaleString()} kcal
        </Text>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.entry}>
          <View style={styles.entryTop}>
            <View style={styles.entryCopy}>
              <Text style={styles.entryName}>{entry.name}</Text>
              <Text style={styles.entryMeta}>
                {entry.serving} · {entry.source}
              </Text>
              <Text style={styles.entryStatus}>
                {entry.estimated ? "Estimated" : "Recorded"} ·{" "}
                {entry.confidence == null
                  ? "confidence not provided"
                  : `${Math.round(entry.confidence * 100)}% confidence`}
              </Text>
            </View>
            <Text style={styles.entryKcal}>
              {Math.round(entry.calories).toLocaleString()}
              <Text style={styles.entryUnit}> kcal</Text>
            </Text>
          </View>
          <View style={styles.actions}>
            <EntryAction
              accessibilityLabel={`Edit ${entry.name} through a new preview`}
              label="Edit"
              onPress={() => onEdit(entry)}
            />
            <EntryAction
              accessibilityLabel={`Copy ${entry.name} as a new preview`}
              label="Copy"
              onPress={() => onCopy(entry)}
            />
            <EntryAction
              accessibilityLabel={`Delete ${entry.name}`}
              danger
              label="Delete"
              onPress={() => onDelete(entry)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function EntryAction({
  accessibilityLabel,
  danger = false,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  danger?: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      android_ripple={{
        color: danger
          ? theme.colors.dangerContainer
          : theme.colors.brandContainer,
      }}
      onPress={onPress}
      style={({ pressed }) => [styles.entryAction, pressed && styles.pressed]}
    >
      <Text style={danger ? styles.dangerActionText : styles.entryActionText}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatLocalDate(localDate: string) {
  const date = new Date(`${localDate}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return localDate;
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
    weekday: "long",
  }).format(date);
}

function createStyles({ colors, radius, spacing, type, typeScale }: AppTheme) {
  return StyleSheet.create({
    masthead: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      paddingTop: spacing.md,
    },
    dayHead: {
      alignItems: "flex-end",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      justifyContent: "space-between",
      marginTop: spacing.lg,
    },
    dayCopy: { flex: 1, minWidth: 180 },
    dateLabel: {
      color: colors.textMuted,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    dayTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.display,
      letterSpacing: -1,
      lineHeight: 42,
      marginTop: 2,
    },
    dayStatus: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      paddingBottom: 6,
    },
    cachedNotice: {
      borderLeftColor: colors.brand,
      borderLeftWidth: 3,
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    mealsHead: {
      alignItems: "flex-end",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      justifyContent: "space-between",
      marginTop: spacing.xl,
    },
    mealsTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.headline,
      lineHeight: 32,
    },
    mealsMeta: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      paddingBottom: 3,
    },
    emptyDay: {
      borderBottomColor: colors.borderStrong,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: spacing.md,
      paddingVertical: spacing.lg,
    },
    emptyTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 24,
    },
    emptyCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.xs,
      maxWidth: 440,
    },
    emptyAction: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginTop: spacing.sm,
      minHeight: 48,
      paddingRight: spacing.sm,
    },
    emptyActionText: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.bodySmall,
    },
    emptyArrow: {
      color: colors.brandStrong,
      fontFamily: type.body,
      fontSize: typeScale.title,
    },
    mealSection: { marginTop: spacing.xl },
    mealHead: {
      alignItems: "flex-end",
      borderBottomColor: colors.borderStrong,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      justifyContent: "space-between",
      paddingBottom: spacing.sm,
    },
    mealTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 24,
    },
    mealTotal: {
      color: colors.textFaint,
      fontFamily: type.numeric,
      fontSize: typeScale.caption,
      paddingBottom: 2,
    },
    entry: {
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: spacing.md,
    },
    entryTop: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    entryCopy: { flex: 1, minWidth: 210 },
    entryName: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 23,
    },
    entryMeta: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      marginTop: 2,
    },
    entryStatus: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.xs,
    },
    entryKcal: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: typeScale.body,
      lineHeight: 23,
    },
    entryUnit: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    entryAction: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      minWidth: 64,
      paddingHorizontal: spacing.sm,
    },
    entryActionText: {
      color: colors.textMuted,
      fontFamily: type.label,
      fontSize: typeScale.label,
    },
    dangerActionText: {
      color: colors.danger,
      fontFamily: type.label,
      fontSize: typeScale.label,
    },
    pressed: { opacity: 0.68 },
    deletePanel: {
      backgroundColor: colors.dangerContainer,
      borderColor: colors.danger,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    deleteTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.title,
      lineHeight: 27,
    },
    deleteCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
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
    refreshingCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.md,
    },
    loadingSummary: {
      borderBottomColor: colors.borderStrong,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: spacing.lg,
      paddingVertical: spacing.lg,
    },
    loadingLabel: {
      color: colors.textFaint,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.6,
    },
    loadingMetric: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      height: 48,
      marginTop: spacing.sm,
      width: 180,
    },
    loadingRail: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      height: 8,
      marginTop: spacing.lg,
      width: "100%",
    },
    loadingMacros: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    loadingMacro: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      flex: 1,
      height: 56,
    },
    loadingMeals: { gap: spacing.md, marginTop: spacing.xl },
    loadingLineWide: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      height: 52,
      opacity: 0.72,
    },
    loadingLine: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      height: 18,
      opacity: 0.55,
      width: "55%",
    },
  });
}
