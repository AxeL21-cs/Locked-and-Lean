import { useQuery } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { mobileApi } from "../../services/supabase";

export function SavedFoodsList() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["saved-foods"],
    queryFn: () => mobileApi.listSavedFoods(),
  });
  return (
    <Screen>
      <ScreenHeader
        eyebrow="PRIVATE LIBRARY"
        title="Saved foods"
        annotation="Select to preview"
      />
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
          <Pressable
            accessibilityHint="Opens a new manual preview; does not log immediately"
            accessibilityLabel={`${food.foodName}, ${food.serving}, ${food.calories} calories`}
            accessibilityRole="button"
            key={food.id}
            onPress={() =>
              router.push({
                pathname: "/manual-entry",
                params: {
                  name: food.foodName,
                  calories: String(food.calories),
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
                {food.serving} · P {food.proteinG} · C {food.carbohydratesG} · F{" "}
                {food.fatG}
              </Text>
            </View>
            <Text style={styles.kcal}>{food.calories} kcal</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  list: { gap: spacing.md, marginTop: spacing.xl },
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
});
