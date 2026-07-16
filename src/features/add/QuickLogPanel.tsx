import { useQuery } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "../../design-system/tokens";
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

function QuickButton({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Creates or opens a new preview; it does not log immediately"
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
    >
      <Text style={styles.quickTitle}>{label}</Text>
      <Text style={styles.quickDetail}>{detail}</Text>
      <Text style={styles.review}>REVIEW →</Text>
    </Pressable>
  );
}

export function QuickLogPanel() {
  const router = useRouter();
  const { session } = useSession();
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

  if (!breakfast && !usualRice && !recent.length && !favorites.length)
    return null;
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

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  eyebrow: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 11,
    letterSpacing: 1,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 28,
    marginTop: spacing.xs,
  },
  copy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  quick: {
    backgroundColor: colors.paperRaised,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    minHeight: 76,
    padding: spacing.md,
  },
  pressed: { opacity: 0.72 },
  quickTitle: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 16 },
  quickDetail: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
    paddingRight: 64,
  },
  review: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 11,
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
  },
  copyYesterday: {
    alignItems: "center",
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  copyYesterdayText: {
    color: colors.ink,
    fontFamily: type.label,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
