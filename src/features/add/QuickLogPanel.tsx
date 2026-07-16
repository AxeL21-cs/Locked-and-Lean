import { useQuery } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../../design-system/theme";
import { useAppTheme } from "../../design-system/theme";
import { addLocalDateDays, localDateInManila } from "../../domain/history";
import {
  mobileApi,
  type DayHistory,
  type SavedFood,
} from "../../services/supabase";
import { useSession } from "../auth/SessionProvider";
import {
  cacheKeys,
  getCache,
  inputParams,
  listFavoriteIds,
  listFoodContext,
  putCache,
  type FoodContextSuggestion,
} from "../offline/offlineStore";

type QuickStyles = ReturnType<typeof createStyles>;

function QuickButton({
  label,
  detail,
  onPress,
  rippleColor,
  styles,
}: {
  label: string;
  detail: string;
  onPress: () => void;
  rippleColor: string;
  styles: QuickStyles;
}) {
  return (
    <Pressable
      accessibilityHint="Creates or opens a new preview; it does not log immediately"
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityRole="button"
      android_ripple={{ color: rippleColor }}
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
    >
      <Text style={styles.quickTitle}>{label}</Text>
      <Text style={styles.quickDetail}>{detail}</Text>
      <View style={styles.reviewRow}>
        <Text style={styles.review}>CREATE PREVIEW</Text>
        <Text style={styles.reviewArrow}>→</Text>
      </View>
    </Pressable>
  );
}

export function QuickLogPanel() {
  const router = useRouter();
  const { session } = useSession();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ownerId = session?.user.id;
  const yesterday = addLocalDateDays(localDateInManila(new Date()), -1);
  const [contexts, setContexts] = useState<FoodContextSuggestion[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const history = useQuery({
    queryKey: ["quick-history", yesterday, ownerId],
    enabled: Boolean(ownerId),
    queryFn: async () => {
      try {
        const value = await mobileApi.getDayHistory(yesterday);
        await putCache(ownerId!, cacheKeys.day(yesterday), value);
        return value;
      } catch (error) {
        const cached = await getCache<DayHistory>(
          ownerId!,
          cacheKeys.day(yesterday),
        );
        if (cached) return cached.value;
        throw error;
      }
    },
  });
  const saved = useQuery({
    queryKey: ["saved-foods", ownerId],
    enabled: Boolean(ownerId),
    queryFn: async () => {
      try {
        const value = await mobileApi.listSavedFoods();
        await putCache(ownerId!, cacheKeys.savedFoods, value);
        return value;
      } catch (error) {
        const cached = await getCache<SavedFood[]>(
          ownerId!,
          cacheKeys.savedFoods,
        );
        if (cached) return cached.value;
        throw error;
      }
    },
  });

  useEffect(() => {
    if (!ownerId) return;
    void Promise.all([listFoodContext(ownerId), listFavoriteIds(ownerId)]).then(
      ([nextContexts, ids]) => {
        setContexts(nextContexts);
        setFavoriteIds(ids);
      },
    );
  }, [ownerId]);

  const breakfast = history.data?.entries.find(
    (entry) => entry.mealType === "breakfast",
  );
  const recent = history.data?.entries.slice().reverse().slice(0, 3) ?? [];
  const favorites = useMemo(
    () =>
      saved.data?.filter((food) => favoriteIds.has(food.id)).slice(0, 3) ?? [],
    [favoriteIds, saved.data],
  );
  const usualRice = contexts.find((item) =>
    /rice|kanin|sinangag/i.test(item.foodName),
  );

  if (ownerId && history.isLoading && saved.isLoading)
    return (
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel="Loading your usual foods"
        style={styles.loadingCard}
      >
        <View style={styles.loadingRule} />
        <View style={styles.loadingCopy}>
          <Text style={styles.loadingLabel}>YOUR USUALS</Text>
          <Text style={styles.loadingTitle}>Checking recent portions…</Text>
        </View>
      </View>
    );

  if (!breakfast && !usualRice && !recent.length && !favorites.length)
    return null;

  const quickProps = {
    rippleColor: theme.colors.brandContainer,
    styles,
  };

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>QUICK LOG · PREVIEW STILL REQUIRED</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Your usuals
      </Text>
      <Text style={styles.copy}>
        Shortcuts use your confirmed history as a starting point, never as proof
        that today’s portion is identical.
      </Text>
      {breakfast ? (
        <QuickButton
          {...quickProps}
          label="Repeat breakfast"
          detail={`${breakfast.originalDescription} · from yesterday`}
          onPress={() =>
            router.push({
              pathname: "/repeat-entry",
              params: {
                entryId: breakfast.id,
                meal: "breakfast",
                label: "Repeat breakfast",
              },
            } as unknown as Href)
          }
        />
      ) : null}
      {usualRice ? (
        <QuickButton
          {...quickProps}
          label="Usual rice at home"
          detail={`${usualRice.historicalLabel} · historical suggestion`}
          onPress={() =>
            router.push({
              pathname: "/manual-entry",
              params: inputParams(usualRice),
            } as unknown as Href)
          }
        />
      ) : null}
      {recent.map((entry) => (
        <QuickButton
          {...quickProps}
          key={entry.id}
          label={
            entry.originalDescription ||
            entry.items[0]?.foodName ||
            "Recent food"
          }
          detail={`${entry.mealType} yesterday · ${Math.round(entry.calories)} kcal`}
          onPress={() =>
            router.push({
              pathname: "/repeat-entry",
              params: {
                entryId: entry.id,
                meal: entry.mealType,
                label: "Recent food",
              },
            } as unknown as Href)
          }
        />
      ))}
      {favorites.map((food) => (
        <QuickButton
          {...quickProps}
          key={food.id}
          label={`★ ${food.foodName}`}
          detail={`${food.serving} · saved favorite`}
          onPress={() =>
            router.push({
              pathname: "/manual-entry",
              params: {
                name: food.foodName,
                calories: String(food.calories),
                proteinG: String(food.proteinG),
                carbohydratesG: String(food.carbohydratesG),
                fatG: String(food.fatG),
                copy: "favorite",
              },
            } as unknown as Href)
          }
        />
      ))}
      {history.data?.entries.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy yesterday, review each entry separately"
          android_ripple={{ color: theme.colors.brandContainer }}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/calendar",
              params: { date: yesterday },
            } as unknown as Href)
          }
          style={styles.copyYesterday}
        >
          <Text style={styles.copyYesterdayText}>
            COPY YESTERDAY · REVIEW EACH ENTRY
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = ({
  colors,
  elevation,
  radius,
  spacing,
  type,
  typeScale,
}: AppTheme) =>
  StyleSheet.create({
    section: { marginTop: spacing.xl },
    eyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.9,
    },
    title: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.headline,
      lineHeight: 34,
      marginTop: spacing.xs,
    },
    copy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },
    quick: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.sm,
      minHeight: 96,
      overflow: "hidden",
      padding: spacing.md,
      ...elevation.card,
    },
    pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
    quickTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 22,
    },
    quickDetail: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.label,
      lineHeight: 19,
      marginTop: 3,
    },
    reviewRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    review: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.7,
    },
    reviewArrow: {
      color: colors.brandStrong,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
    },
    copyYesterday: {
      alignItems: "center",
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      marginTop: spacing.md,
      minHeight: 52,
      overflow: "hidden",
      paddingHorizontal: spacing.md,
    },
    copyYesterdayText: {
      color: colors.text,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.5,
      textAlign: "center",
    },
    loadingCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xl,
      minHeight: 88,
      padding: spacing.md,
    },
    loadingRule: {
      alignSelf: "stretch",
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      width: 5,
    },
    loadingCopy: { flex: 1 },
    loadingLabel: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.8,
    },
    loadingTitle: {
      color: colors.textMuted,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 22,
      marginTop: 3,
    },
  });
