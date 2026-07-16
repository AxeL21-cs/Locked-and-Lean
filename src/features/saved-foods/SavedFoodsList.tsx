import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, spacing, type } from "../../design-system/tokens";
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
                {favorites.has(food.id) ? "★" : "☆"}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  list: { gap: spacing.md, marginTop: spacing.xl },
  favoriteWrap: { position: "relative" },
  row: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 78,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  copy: { flex: 1 },
  name: { color: colors.ink, fontFamily: type.display, fontSize: 20 },
  meta: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  kcal: { color: colors.ink, fontFamily: type.label, fontSize: 13 },
  favoriteButton: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    position: "absolute",
    right: 4,
    top: 0,
  },
  favoriteText: { color: colors.calamansiDeep, fontSize: 24 },
  deviceNote: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
