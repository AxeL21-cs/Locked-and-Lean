import { StyleSheet, Text, View } from "react-native";

import { ChoiceChips } from "../../components/ChoiceChips";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import type { CalendarDayView } from "../calendar/types";
import type {
  ProgressDashboardData,
  ProgressRangeDays,
  WeightTrendView,
} from "./types";

const RANGE_CHOICES = [
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
  { label: "60 days", value: "60" },
] as const;

const value = (number: number | null, unit: string) =>
  number == null ? "Unknown" : `${Math.round(number * 10) / 10} ${unit}`;

function WeightDirection({ change }: { change: number | null }) {
  if (change == null)
    return <Text style={styles.weightDirection}>• FIRST POINT</Text>;
  if (change > 0)
    return (
      <Text style={styles.weightDirection}>
        ↑ UP {Math.abs(change).toFixed(1)} KG
      </Text>
    );
  if (change < 0)
    return (
      <Text style={styles.weightDirection}>
        ↓ DOWN {Math.abs(change).toFixed(1)} KG
      </Text>
    );
  return <Text style={styles.weightDirection}>= NO CHANGE</Text>;
}

function NutritionChart({ days }: { days: CalendarDayView[] }) {
  const visible = days.slice(-14);
  const maximum = Math.max(
    1,
    ...visible.flatMap((day) => [
      day.snapshot.calories,
      day.snapshot.calorieTarget ?? 0,
    ]),
  );
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHead}>
        <View style={styles.flex}>
          <Text style={styles.chartEyebrow}>CONFIRMED ENERGY</Text>
          <Text style={styles.chartTitle}>Daily calorie ledger</Text>
        </View>
        <Text style={styles.chartNote}>Latest {visible.length} days</Text>
      </View>
      <View
        accessibilityLabel="Daily calorie trend. Each column includes a text status below it."
        accessibilityRole="summary"
        style={styles.barChart}
      >
        {visible.map((day) => {
          const height = day.snapshot.hasEntries
            ? Math.max(8, Math.round((day.snapshot.calories / maximum) * 112))
            : 3;
          return (
            <View
              accessible
              accessibilityLabel={`${day.accessibilityLabel}. ${Math.round(day.snapshot.calories)} calories. ${day.status.accessibilityLabel}.`}
              key={day.localDate}
              style={styles.barColumn}
            >
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height },
                    day.status.status === "above_target" && styles.barAbove,
                    day.status.status === "incomplete" && styles.barIncomplete,
                    day.status.status === "no_records" && styles.barMissing,
                  ]}
                />
              </View>
              <Text style={styles.barSymbol}>{day.status.symbol}</Text>
              <Text style={styles.barDate}>{day.localDate.slice(8)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.legend}>
        Symbols: = within target · ↓ below · ↑ above · ? incomplete · · no
        records.
      </Text>
    </View>
  );
}

function MacroTrend({ days }: { days: CalendarDayView[] }) {
  const logged = days.filter((day) => day.snapshot.hasEntries).slice(-7);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Macro snapshots</Text>
        <Text style={styles.sectionMeta}>Latest 7 logged days</Text>
      </View>
      {logged.length ? (
        logged.map((day) => (
          <View
            accessible
            accessibilityLabel={`${day.localDate}. Protein ${value(day.snapshot.proteinG, "grams")}. Carbohydrates ${value(day.snapshot.carbohydratesG, "grams")}. Fat ${value(day.snapshot.fatG, "grams")}. ${day.snapshot.macroDataComplete ? "Complete macros" : "Incomplete macros"}.`}
            key={day.localDate}
            style={styles.macroRow}
          >
            <Text style={styles.macroDate}>{day.localDate.slice(5)}</Text>
            <Text style={styles.macroValue}>
              P {value(day.snapshot.proteinG, "g")}
            </Text>
            <Text style={styles.macroValue}>
              C {value(day.snapshot.carbohydratesG, "g")}
            </Text>
            <Text style={styles.macroValue}>
              F {value(day.snapshot.fatG, "g")}
            </Text>
            <Text style={styles.macroStatus}>
              {day.snapshot.macroDataComplete ? "✓ COMPLETE" : "? INCOMPLETE"}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>
          No confirmed nutrition days in this range. Missing macros are not
          interpolated.
        </Text>
      )}
    </View>
  );
}

function WeightChart({
  points,
  truncated,
}: {
  points: WeightTrendView[];
  truncated: boolean;
}) {
  const visible = points.slice(-12);
  const weights = visible.map((point) => point.weightKg);
  const minimum = weights.length ? Math.min(...weights) : 0;
  const maximum = weights.length ? Math.max(...weights) : 0;
  const span = Math.max(1, maximum - minimum);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Weight observations</Text>
        <Text style={styles.sectionMeta}>Recorded points only</Text>
      </View>
      {truncated ? (
        <Text accessibilityRole="alert" style={styles.truncated}>
          The server has more weight points than this response shows. Summary
          values remain server-calculated.
        </Text>
      ) : null}
      {visible.length ? (
        <View style={styles.weightList}>
          {visible.map((point) => {
            const level = 18 + ((point.weightKg - minimum) / span) * 54;
            return (
              <View
                accessible
                accessibilityLabel={`${point.localDate}. ${point.weightKg} kilograms. ${point.changeFromPreviousKg == null ? "First point" : `${point.changeFromPreviousKg > 0 ? "Up" : point.changeFromPreviousKg < 0 ? "Down" : "No change"} ${Math.abs(point.changeFromPreviousKg)} kilograms from previous${point.daysSincePrevious == null ? "" : ` after ${point.daysSincePrevious} days`}`}.`}
                key={point.id}
                style={styles.weightRow}
              >
                <View style={[styles.weightMarker, { width: `${level}%` }]} />
                <View style={styles.weightCopy}>
                  <Text style={styles.weightValue}>{point.weightKg} kg</Text>
                  <WeightDirection change={point.changeFromPreviousKg} />
                </View>
                <Text style={styles.weightDate}>{point.localDate}</Text>
                {point.daysSincePrevious != null ? (
                  <Text style={styles.weightGap}>
                    {point.daysSincePrevious} DAYS SINCE PRIOR MEASUREMENT
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          No weight observations in this range. Gaps remain gaps and no trend is
          invented.
        </Text>
      )}
    </View>
  );
}

export function ProgressDashboard({
  data,
  rangeDays,
  onRangeChange,
}: {
  data: ProgressDashboardData;
  rangeDays: ProgressRangeDays;
  onRangeChange: (days: ProgressRangeDays) => void;
}) {
  const summary = data.summary;
  return (
    <View>
      <ChoiceChips
        choices={RANGE_CHOICES}
        label="Trend range"
        onChange={(range) => onRangeChange(Number(range) as ProgressRangeDays)}
        value={String(rangeDays) as "14" | "30" | "60"}
      />
      <View style={styles.summaryGrid}>
        <View accessible style={styles.summaryPrimary}>
          <Text style={styles.summaryEyebrow}>LOGGED DAYS</Text>
          <Text style={styles.summaryNumber}>{summary.loggedDays}</Text>
          <Text style={styles.summaryCaption}>
            of {summary.rangeDays} days · {summary.totalEntries} confirmed
            entries
          </Text>
        </View>
        <View accessible style={styles.summarySecondary}>
          <Text style={styles.summaryDarkEyebrow}>SERVER DAILY AVERAGE</Text>
          <Text style={styles.summaryDarkNumber}>
            {summary.averageDailyCalories == null
              ? "—"
              : Math.round(summary.averageDailyCalories)}
          </Text>
          <Text style={styles.summaryDarkCaption}>
            {summary.averageDailyCalories == null
              ? "NO LOGGED DAYS"
              : "KCAL · LOGGED DAYS ONLY"}
          </Text>
        </View>
      </View>
      <View style={styles.macroSummary}>
        <Text style={styles.macroSummaryTitle}>Server macro averages</Text>
        <Text style={styles.macroSummaryCopy}>
          Based on {summary.completeMacroDays} complete-macro{" "}
          {summary.completeMacroDays === 1 ? "day" : "days"}; incomplete days
          are excluded, never filled with zero.
        </Text>
        <View style={styles.macroSummaryValues}>
          <Text style={styles.macroSummaryValue}>
            P {value(summary.averageDailyProteinG, "g")}
          </Text>
          <Text style={styles.macroSummaryValue}>
            C {value(summary.averageDailyCarbohydratesG, "g")}
          </Text>
          <Text style={styles.macroSummaryValue}>
            F {value(summary.averageDailyFatG, "g")}
          </Text>
        </View>
      </View>
      <View accessibilityRole="summary" style={styles.weightSummary}>
        <Text style={styles.weightSummaryEyebrow}>
          WEIGHT ACROSS THIS RANGE
        </Text>
        {summary.latestWeightKg == null ? (
          <Text style={styles.weightSummaryEmpty}>No recorded weights</Text>
        ) : (
          <>
            <Text style={styles.weightSummaryValue}>
              {summary.latestWeightKg} kg
            </Text>
            <Text style={styles.weightSummaryDirection}>
              {summary.weightChangeKg == null
                ? "FIRST RECORDED POINT IN RANGE"
                : summary.weightChangeKg > 0
                  ? `↑ UP ${Math.abs(summary.weightChangeKg).toFixed(1)} KG`
                  : summary.weightChangeKg < 0
                    ? `↓ DOWN ${Math.abs(summary.weightChangeKg).toFixed(1)} KG`
                    : "= NO CHANGE"}
            </Text>
            <Text style={styles.weightSummaryDates}>
              {summary.firstWeightDate ?? "Unknown start"} →{" "}
              {summary.latestWeightDate ?? "Unknown latest"}
            </Text>
          </>
        )}
      </View>
      <NutritionChart days={data.nutritionDays} />
      <MacroTrend days={data.nutritionDays} />
      <WeightChart
        points={data.weightPoints}
        truncated={data.weightTruncated}
      />
      <Text style={styles.serverStamp}>
        Range {summary.startDate} to {summary.endDate} · server calculated{" "}
        {summary.serverCalculatedAt} · Asia/Manila
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryGrid: { gap: spacing.md, marginTop: spacing.lg },
  summaryPrimary: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  summarySecondary: {
    backgroundColor: colors.calamansi,
    borderColor: colors.ink,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
  },
  summaryEyebrow: {
    color: colors.calamansi,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.7,
  },
  summaryNumber: {
    color: colors.rice,
    fontFamily: type.display,
    fontSize: 54,
    lineHeight: 60,
    marginTop: spacing.xs,
  },
  summaryCaption: {
    color: colors.riceDark,
    fontFamily: type.body,
    fontSize: 11,
  },
  summaryDarkEyebrow: {
    color: colors.inkMuted,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.7,
  },
  summaryDarkNumber: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 48,
    lineHeight: 54,
    marginTop: spacing.xs,
  },
  summaryDarkCaption: {
    color: colors.inkMuted,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1,
  },
  macroSummary: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  macroSummaryTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 21,
  },
  macroSummaryCopy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  macroSummaryValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  macroSummaryValue: {
    color: colors.ink,
    fontFamily: type.label,
    fontSize: 11,
  },
  weightSummary: {
    backgroundColor: colors.skyWash,
    borderColor: colors.inkRule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  weightSummaryEyebrow: {
    color: colors.inkMuted,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  weightSummaryValue: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 34,
    marginTop: spacing.sm,
  },
  weightSummaryDirection: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  weightSummaryDates: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 10,
    marginTop: spacing.sm,
  },
  weightSummaryEmpty: {
    color: colors.inkFaint,
    fontFamily: type.display,
    fontSize: 21,
    marginTop: spacing.sm,
  },
  chartCard: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  chartHead: { alignItems: "flex-end", flexDirection: "row", gap: spacing.md },
  chartEyebrow: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  chartTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 24,
    marginTop: 2,
  },
  chartNote: { color: colors.inkFaint, fontFamily: type.body, fontSize: 9 },
  barChart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 3,
    height: 154,
    marginTop: spacing.lg,
  },
  barColumn: { alignItems: "center", flex: 1 },
  barTrack: { flex: 1, justifyContent: "flex-end", width: "72%" },
  bar: {
    backgroundColor: colors.calamansiDeep,
    borderRadius: 3,
    minHeight: 3,
    width: "100%",
  },
  barAbove: { backgroundColor: colors.tomato },
  barIncomplete: { backgroundColor: colors.inkFaint },
  barMissing: { backgroundColor: colors.rule },
  barSymbol: {
    color: colors.ink,
    fontFamily: type.label,
    fontSize: 9,
    marginTop: 3,
  },
  barDate: { color: colors.inkFaint, fontFamily: type.body, fontSize: 7 },
  legend: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 9,
    lineHeight: 14,
    marginTop: spacing.md,
  },
  section: { marginTop: spacing.xl },
  sectionHead: {
    alignItems: "flex-end",
    borderBottomColor: colors.ink,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  sectionTitle: { color: colors.ink, fontFamily: type.display, fontSize: 25 },
  sectionMeta: { color: colors.inkFaint, fontFamily: type.body, fontSize: 9 },
  macroRow: {
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.md,
  },
  macroDate: {
    color: colors.inkFaint,
    fontFamily: type.label,
    fontSize: 9,
    width: 42,
  },
  macroValue: { color: colors.ink, fontFamily: type.label, fontSize: 9 },
  macroStatus: {
    color: colors.calamansiDeep,
    flexBasis: "100%",
    fontFamily: type.label,
    fontSize: 8,
    letterSpacing: 0.7,
    marginLeft: 50,
  },
  emptyText: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: spacing.lg,
  },
  truncated: {
    backgroundColor: colors.tomatoWash,
    color: colors.ink,
    fontFamily: type.bodyStrong,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  weightList: { marginTop: spacing.sm },
  weightRow: {
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    minHeight: 68,
    paddingVertical: spacing.md,
  },
  weightMarker: {
    backgroundColor: colors.skyWash,
    borderRightColor: colors.calamansiDeep,
    borderRightWidth: 4,
    height: 8,
    marginBottom: spacing.sm,
  },
  weightCopy: { alignItems: "baseline", flexDirection: "row", gap: spacing.md },
  weightValue: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 15 },
  weightDirection: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 8,
    letterSpacing: 0.7,
  },
  weightDate: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 10,
    marginTop: 2,
  },
  weightGap: {
    color: colors.inkFaint,
    fontFamily: type.label,
    fontSize: 8,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  serverStamp: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 9,
    lineHeight: 15,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
});
