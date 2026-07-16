import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { type AppTheme, useAppTheme } from "../../design-system/theme";
import { mobileApi, type SavedFood } from "../../services/supabase";
import { useSession } from "../auth/SessionProvider";
import {
  cacheKeys,
  getCache,
  listFavoriteIds,
  putCache,
  setFavorite,
} from "../offline/offlineStore";

export function SavedFoodsList() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { session } = useSession();
  const ownerId = session?.user.id;
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (ownerId) void listFavoriteIds(ownerId).then(setFavorites);
  }, [ownerId]);
  const query = useQuery({
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
  return (
    <Screen>
      <ScreenHeader
        eyebrow="PRIVATE LIBRARY"
        title="Saved foods"
        annotation="Select to preview"
      />
      <Text style={styles.deviceNote}>
        Stars are favorites on this device only. Saved nutrition is cached for
        offline viewing.
      </Text>
      {query.isLoading ? (
        <AsyncStatePanel
          kind="loading"
          title="Loading saved foods"
          message="Reading only foods owned by your signed-in account."
        />
      ) : null}
      {query.error ? (
        <AsyncStatePanel
          actionLabel="Retry"
          kind="error"
          message={query.error.message}
          onAction={() => query.refetch()}
          title="Saved foods unavailable"
        />
      ) : null}
      {query.data?.length === 0 ? (
        <AsyncStatePanel
          actionLabel="Enter a food"
          kind="empty"
          message="Confirm a manual food with “Save for reuse” to build your private list."
          onAction={() => router.push("/manual-entry" as Href)}
          title="No saved foods yet"
        />
      ) : null}
      <View style={styles.list}>
        {query.data?.map((food) => (
          <View key={food.id} style={styles.favoriteWrap}>
            <Pressable
              accessibilityHint="Opens a new manual preview; does not log immediately"
              accessibilityLabel={`${food.foodName}, ${food.serving}, ${food.calories} calories`}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/manual-entry",
                  params: {
                    name: food.foodName,
                    calories: String(food.calories),
                    proteinG: String(food.proteinG),
                    carbohydratesG: String(food.carbohydratesG),
                    fatG: String(food.fatG),
                    copy: "saved",
                  },
                } as unknown as Href)
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.copy}>
                <Text style={styles.name}>{food.foodName}</Text>
                <Text style={styles.meta}>
                  {food.brand ? `${food.brand} · ` : ""}
                  {food.serving} · P {food.proteinG} · C {food.carbohydratesG} ·
                  F {food.fatG}
                </Text>
              </View>
              <Text style={styles.kcal}>{food.calories} kcal</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`${favorites.has(food.id) ? "Remove" : "Add"} ${food.foodName} ${favorites.has(food.id) ? "from" : "to"} device favorites`}
              accessibilityRole="button"
              accessibilityState={{ selected: favorites.has(food.id) }}
              onPress={async () => {
                if (!ownerId) return;
                const next = !favorites.has(food.id);
                await setFavorite(ownerId, food.id, next);
                setFavorites((current) => {
                  const copy = new Set(current);
                  if (next) copy.add(food.id);
                  else copy.delete(food.id);
                  return copy;
                });
                await Haptics.selectionAsync();
              }}
              style={styles.favoriteButton}
            >
              <Text style={styles.favoriteText}>
                {favorites.has(food.id)
                  ? "★ Device favorite"
                  : "☆ Add to favorites"}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </Screen>
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
    list: { gap: spacing.md, marginTop: spacing.xl },
    favoriteWrap: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      overflow: "hidden",
      ...elevation.card,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      minHeight: 78,
      padding: spacing.lg,
    },
    pressed: { opacity: 0.7 },
    copy: { flex: 1 },
    name: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.title,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: 3,
    },
    kcal: {
      color: colors.text,
      fontFamily: type.label,
      fontSize: typeScale.label,
    },
    favoriteButton: {
      alignItems: "center",
      borderTopColor: colors.border,
      borderTopWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    favoriteText: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.label,
    },
    deviceNote: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.md,
    },
  });
