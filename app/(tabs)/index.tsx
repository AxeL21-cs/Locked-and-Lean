import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../src/components/ActionButton";
import { AsyncStatePanel } from "../../src/components/AsyncStatePanel";
import { MacroRail } from "../../src/components/MacroRail";
import { Screen } from "../../src/components/Screen";
import { PRODUCT } from "../../src/design-system/product";
import { colors, radius, spacing, type } from "../../src/design-system/tokens";
import {
  mobileApi,
  type FoodEntry,
  type MealType,
} from "../../src/services/supabase";

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};
export default function TodayScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<FoodEntry | null>(null);
  const query = useQuery({
    queryKey: ["today"],
    queryFn: () => mobileApi.getTodaySummary(),
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
        <AsyncStatePanel
          kind="loading"
          title="Opening today’s record"
          message="Reading your confirmed entries and server-calculated summary."
        />
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
        <View>
          <Text style={styles.brand}>{PRODUCT.name}</Text>
          <Text style={styles.kicker}>
            {summary.localDate} · MANILA FIELD LOG
          </Text>
        </View>
        <View style={styles.live}>
          <Text style={styles.liveDot}>●</Text>
          <Text style={styles.liveText}>CONFIRMED</Text>
        </View>
      </View>
      <View
        style={styles.energyCard}
        accessible
        accessibilityLabel={
          remaining == null
            ? `${summary.caloriesConsumed} calories consumed; no active target`
            : `${remaining} calories remaining`
        }
      >
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

const styles = StyleSheet.create({
  masthead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  brand: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 30,
    letterSpacing: -1.1,
  },
  kicker: {
    color: colors.inkFaint,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.3,
    marginTop: 3,
  },
  live: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  liveDot: { color: colors.calamansiDeep, fontSize: 8 },
  liveText: {
    color: colors.inkMuted,
    fontFamily: type.label,
    fontSize: 8,
    letterSpacing: 1,
  },
  energyCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    marginTop: spacing.xl,
    overflow: "hidden",
    padding: spacing.xl,
  },
  cardEyebrow: {
    color: colors.calamansi,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.8,
  },
  remaining: {
    color: colors.rice,
    fontFamily: type.display,
    fontSize: 62,
    letterSpacing: -3,
    lineHeight: 68,
    marginTop: spacing.sm,
  },
  remainingLabel: {
    color: colors.calamansi,
    fontFamily: type.label,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },
  macroGrid: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  section: { marginTop: spacing.xl },
  sectionHead: {
    alignItems: "flex-end",
    borderBottomColor: colors.ink,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  sectionTitle: { color: colors.ink, fontFamily: type.display, fontSize: 27 },
  sectionCount: { color: colors.inkFaint, fontFamily: type.body, fontSize: 11 },
  emptyMeal: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 12,
    paddingVertical: spacing.md,
  },
  entry: {
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    paddingVertical: spacing.lg,
  },
  entryTop: { flexDirection: "row", gap: spacing.md },
  entryCopy: { flex: 1 },
  entryName: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 16 },
  entryMeta: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 3,
  },
  entryStatus: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 0.7,
    marginTop: spacing.sm,
  },
  entryKcal: { color: colors.ink, fontFamily: type.label, fontSize: 16 },
  entryUnit: { color: colors.inkFaint, fontFamily: type.body, fontSize: 10 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  smallAction: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: spacing.md,
  },
  smallText: { color: colors.ink, fontFamily: type.label, fontSize: 11 },
  deleteText: { color: "#9F2D17", fontFamily: type.label, fontSize: 11 },
  deletePanel: {
    backgroundColor: colors.tomatoWash,
    borderColor: colors.tomato,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  deleteTitle: { color: colors.ink, fontFamily: type.display, fontSize: 23 },
  deleteCopy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  deleteError: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    marginTop: spacing.md,
  },
  updated: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 10,
    lineHeight: 16,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
});
