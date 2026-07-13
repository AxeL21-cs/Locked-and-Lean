import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { ChoiceChips } from "../../components/ChoiceChips";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import type { MealType } from "../../services/supabase";
import type {
  CalendarDayView,
  DayHistoryView,
  HistoryEntryView,
  HistoryViewMode,
} from "./types";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MODES = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
] as const;
const MEALS: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const number = (value: number | null, unit: string) =>
  value == null ? "Unknown" : `${Math.round(value * 10) / 10} ${unit}`;

function DayButton({
  day,
  selected,
  compact,
  onPress,
}: {
  day: CalendarDayView;
  selected: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  const label = `${day.accessibilityLabel}. ${day.status.accessibilityLabel}. ${day.snapshot.entryCount} confirmed ${day.snapshot.entryCount === 1 ? "entry" : "entries"}. ${Math.round(day.snapshot.calories)} calories.`;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        compact ? styles.dayCell : styles.weekCell,
        !day.inDisplayedMonth && styles.outsideMonth,
        selected && styles.selectedDay,
      ]}
    >
      {!compact ? (
        <Text style={styles.weekLabel}>{day.weekdayLabel}</Text>
      ) : null}
      <Text style={[styles.dayNumber, day.isToday && styles.todayNumber]}>
        {day.dayNumber}
      </Text>
      <Text style={styles.daySymbol}>{day.status.symbol}</Text>
      {!compact ? (
        <>
          <Text style={styles.weekStatus}>{day.status.label}</Text>
          <Text style={styles.weekKcal}>
            {day.snapshot.hasEntries
              ? `${Math.round(day.snapshot.calories)} kcal`
              : "No entries"}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}

function PeriodNavigator({
  label,
  onNext,
  onPrevious,
  onToday,
}: {
  label: string;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
}) {
  return (
    <View style={styles.periodNavigator}>
      <Pressable
        accessibilityLabel="Previous period"
        accessibilityRole="button"
        onPress={onPrevious}
        style={styles.periodArrow}
      >
        <Text style={styles.periodArrowText}>‹</Text>
      </Pressable>
      <Pressable
        accessibilityHint="Returns the history calendar to today in Manila"
        accessibilityLabel={`${label}. Go to today`}
        accessibilityRole="button"
        onPress={onToday}
        style={styles.periodTitleButton}
      >
        <Text style={styles.periodTitle}>{label}</Text>
        <Text style={styles.periodToday}>TODAY · MANILA</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Next period"
        accessibilityRole="button"
        onPress={onNext}
        style={styles.periodArrow}
      >
        <Text style={styles.periodArrowText}>›</Text>
      </Pressable>
    </View>
  );
}

function HistoryGrid({
  days,
  mode,
  selectedDate,
  onSelectDate,
}: {
  days: CalendarDayView[];
  mode: HistoryViewMode;
  selectedDate: string;
  onSelectDate: (localDate: string) => void;
}) {
  if (mode === "day") return null;
  return (
    <View style={styles.calendarCard}>
      {mode === "month" ? (
        <View accessibilityElementsHidden style={styles.weekdayRow}>
          {WEEKDAYS.map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>
      ) : null}
      <View
        accessibilityLabel={`${mode} history calendar`}
        accessibilityRole="summary"
        style={mode === "month" ? styles.monthGrid : styles.weekGrid}
      >
        {days.map((day) => (
          <DayButton
            compact={mode === "month"}
            day={day}
            key={day.localDate}
            onPress={() => onSelectDate(day.localDate)}
            selected={day.localDate === selectedDate}
          />
        ))}
      </View>
      <Text style={styles.legend}>
        Every marker includes a symbol and text status; color is supplementary.
      </Text>
    </View>
  );
}

function EntryCard({
  entry,
  onCopy,
  onEdit,
  onAskDelete,
}: {
  entry: HistoryEntryView;
  onCopy: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
}) {
  const title = entry.items[0]?.foodName || entry.originalDescription;
  return (
    <View style={styles.entry}>
      <View style={styles.entryTop}>
        <View style={styles.flex}>
          <Text style={styles.entryName}>{title}</Text>
          <Text style={styles.entryMeta}>
            {entry.items.length} {entry.items.length === 1 ? "item" : "items"} ·{" "}
            {entry.sourceKind} · confirmed snapshot
          </Text>
        </View>
        <Text style={styles.entryCalories}>
          {Math.round(entry.calories)}
          <Text style={styles.entryUnit}> kcal</Text>
        </Text>
      </View>
      <Text style={styles.entryMacros}>
        P {number(entry.proteinG, "g")} · C {number(entry.carbohydratesG, "g")}{" "}
        · F {number(entry.fatG, "g")}
      </Text>
      {entry.items
        .flatMap((item) => item.uncertainty)
        .map((warning) => (
          <Text accessibilityRole="alert" key={warning} style={styles.warning}>
            ! {warning}
          </Text>
        ))}
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Edit ${title} through a replacement preview`}
          accessibilityRole="button"
          onPress={onEdit}
          style={styles.entryAction}
        >
          <Text style={styles.entryActionText}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Copy ${title} as a new preview`}
          accessibilityRole="button"
          onPress={onCopy}
          style={styles.entryAction}
        >
          <Text style={styles.entryActionText}>Copy</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Delete ${title}`}
          accessibilityRole="button"
          onPress={onAskDelete}
          style={styles.entryAction}
        >
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DayLedger({
  day,
  history,
  deleting,
  deleteError,
  onCopy,
  onEdit,
  onDelete,
}: {
  day?: CalendarDayView;
  history?: DayHistoryView;
  deleting?: boolean;
  deleteError?: string;
  onCopy: (entry: HistoryEntryView) => void;
  onEdit: (entry: HistoryEntryView) => void;
  onDelete: (entry: HistoryEntryView) => Promise<void>;
}) {
  const [pendingDelete, setPendingDelete] = useState<HistoryEntryView>();
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await onDelete(pendingDelete);
      setPendingDelete(undefined);
    } catch {
      // The parent mutation exposes its accessible error while the confirmation stays open.
    }
  };
  if (!day || !history) return null;
  return (
    <View style={styles.ledger}>
      <View style={styles.ledgerHead}>
        <View style={styles.flex}>
          <Text style={styles.ledgerEyebrow}>
            SELECTED DAY · SERVER SNAPSHOT
          </Text>
          <Text accessibilityRole="header" style={styles.ledgerTitle}>
            {day.accessibilityLabel}
          </Text>
          <Text style={styles.ledgerStatus}>
            {day.status.symbol} {day.status.label} · {day.snapshot.entryCount}{" "}
            confirmed {day.snapshot.entryCount === 1 ? "entry" : "entries"}
          </Text>
        </View>
        <Text style={styles.ledgerCalories}>
          {Math.round(day.snapshot.calories)}
          <Text style={styles.ledgerUnit}> kcal</Text>
        </Text>
      </View>
      <View style={styles.summaryStrip}>
        <Text style={styles.summaryText}>
          Target {number(day.snapshot.calorieTarget, "kcal")}
        </Text>
        <Text style={styles.summaryText}>
          P {number(day.snapshot.proteinG, "g")}
        </Text>
        <Text style={styles.summaryText}>
          C {number(day.snapshot.carbohydratesG, "g")}
        </Text>
        <Text style={styles.summaryText}>
          F {number(day.snapshot.fatG, "g")}
        </Text>
      </View>
      {history.truncated ? (
        <Text accessibilityRole="alert" style={styles.truncated}>
          This day has more confirmed entries than this response can show.
          Totals above remain the server snapshot; refresh or narrow the date to
          reload.
        </Text>
      ) : null}
      {history.entries.length === 0 ? (
        <AsyncStatePanel
          kind="empty"
          message="Nothing is inferred for an empty day. Only confirmed entries appear in history."
          title="No confirmed entries"
        />
      ) : (
        MEALS.map((meal) => {
          const entries = history.entries.filter(
            (entry) => entry.mealType === meal,
          );
          if (!entries.length) return null;
          return (
            <View key={meal} style={styles.mealGroup}>
              <Text style={styles.mealTitle}>{MEAL_LABEL[meal]}</Text>
              {entries.map((entry) => (
                <EntryCard
                  entry={entry}
                  key={entry.id}
                  onAskDelete={() => setPendingDelete(entry)}
                  onCopy={() => onCopy(entry)}
                  onEdit={() => onEdit(entry)}
                />
              ))}
            </View>
          );
        })
      )}
      {pendingDelete ? (
        <View accessibilityRole="alert" style={styles.deletePanel}>
          <Text style={styles.deleteTitle}>Delete this confirmed entry?</Text>
          <Text style={styles.deleteCopy}>
            The server will soft-delete the entry and recalculate that Manila
            day. This cannot be undone.
          </Text>
          {deleteError ? (
            <Text style={styles.deleteError}>{deleteError}</Text>
          ) : null}
          <ActionButton
            busy={deleting}
            label="Confirm delete"
            onPress={() => void confirmDelete()}
            tone="danger"
          />
          <ActionButton
            disabled={deleting}
            label="Keep entry"
            onPress={() => setPendingDelete(undefined)}
            tone="secondary"
          />
        </View>
      ) : null}
      <Text style={styles.serverStamp}>
        Server calculated: {day.snapshot.serverCalculatedAt} · Asia/Manila
      </Text>
    </View>
  );
}

export function HistoryCalendar({
  mode,
  periodLabel,
  days,
  selectedDate,
  selectedDayHistory,
  deleting,
  deleteError,
  onModeChange,
  onNext,
  onPrevious,
  onToday,
  onSelectDate,
  onCopy,
  onEdit,
  onDelete,
}: {
  mode: HistoryViewMode;
  periodLabel: string;
  days: CalendarDayView[];
  selectedDate: string;
  selectedDayHistory?: DayHistoryView;
  deleting?: boolean;
  deleteError?: string;
  onModeChange: (mode: HistoryViewMode) => void;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
  onSelectDate: (localDate: string) => void;
  onCopy: (entry: HistoryEntryView) => void;
  onEdit: (entry: HistoryEntryView) => void;
  onDelete: (entry: HistoryEntryView) => Promise<void>;
}) {
  const selectedDay = days.find((day) => day.localDate === selectedDate);
  return (
    <View>
      <ChoiceChips
        choices={MODES}
        label="History range"
        onChange={onModeChange}
        value={mode}
      />
      <PeriodNavigator
        label={periodLabel}
        onNext={onNext}
        onPrevious={onPrevious}
        onToday={onToday}
      />
      <HistoryGrid
        days={days}
        mode={mode}
        onSelectDate={onSelectDate}
        selectedDate={selectedDate}
      />
      <DayLedger
        day={selectedDay}
        deleteError={deleteError}
        deleting={deleting}
        history={selectedDayHistory}
        onCopy={onCopy}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  periodNavigator: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: spacing.lg,
  },
  periodArrow: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  periodArrowText: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 30,
  },
  periodTitleButton: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  periodTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 24,
    textAlign: "center",
  },
  periodToday: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 8,
    letterSpacing: 1.4,
    marginTop: 3,
  },
  calendarCard: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    overflow: "hidden",
    padding: spacing.sm,
  },
  weekdayRow: { flexDirection: "row", paddingVertical: spacing.sm },
  weekday: {
    color: colors.inkFaint,
    flex: 1,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1,
    textAlign: "center",
  },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  weekGrid: { gap: spacing.sm },
  dayCell: {
    alignItems: "center",
    aspectRatio: 0.9,
    borderColor: "transparent",
    borderRadius: radius.sm,
    borderWidth: 2,
    justifyContent: "center",
    width: "14.2857%",
  },
  weekCell: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: spacing.md,
  },
  outsideMonth: { opacity: 0.35 },
  selectedDay: { backgroundColor: colors.skyWash, borderColor: colors.ink },
  dayNumber: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 13 },
  todayNumber: { textDecorationLine: "underline" },
  daySymbol: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 11,
  },
  weekLabel: {
    color: colors.inkFaint,
    fontFamily: type.label,
    fontSize: 9,
    width: 36,
  },
  weekStatus: {
    color: colors.inkMuted,
    flex: 1,
    fontFamily: type.bodyStrong,
    fontSize: 11,
  },
  weekKcal: { color: colors.ink, fontFamily: type.label, fontSize: 11 },
  legend: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 10,
    lineHeight: 15,
    padding: spacing.sm,
  },
  ledger: { marginTop: spacing.xl },
  ledgerHead: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  ledgerEyebrow: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  ledgerTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 28,
    marginTop: 3,
  },
  ledgerStatus: {
    color: colors.inkMuted,
    fontFamily: type.bodyStrong,
    fontSize: 11,
    marginTop: 4,
  },
  ledgerCalories: { color: colors.ink, fontFamily: type.display, fontSize: 29 },
  ledgerUnit: { color: colors.inkFaint, fontFamily: type.label, fontSize: 9 },
  summaryStrip: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  summaryText: { color: colors.rice, fontFamily: type.label, fontSize: 10 },
  truncated: {
    backgroundColor: colors.tomatoWash,
    color: colors.ink,
    fontFamily: type.bodyStrong,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  mealGroup: { marginTop: spacing.xl },
  mealTitle: {
    borderBottomColor: colors.ink,
    borderBottomWidth: 1,
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 23,
    paddingBottom: spacing.sm,
  },
  entry: {
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    paddingVertical: spacing.lg,
  },
  entryTop: { flexDirection: "row", gap: spacing.md },
  entryName: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 15 },
  entryMeta: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    marginTop: 3,
  },
  entryCalories: { color: colors.ink, fontFamily: type.label, fontSize: 15 },
  entryUnit: { color: colors.inkFaint, fontFamily: type.body, fontSize: 9 },
  entryMacros: {
    color: colors.inkMuted,
    fontFamily: type.label,
    fontSize: 10,
    marginTop: spacing.sm,
  },
  warning: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  entryAction: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: spacing.md,
  },
  entryActionText: { color: colors.ink, fontFamily: type.label, fontSize: 10 },
  deleteActionText: { color: "#9F2D17", fontFamily: type.label, fontSize: 10 },
  deletePanel: {
    backgroundColor: colors.tomatoWash,
    borderColor: colors.tomato,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  deleteTitle: { color: colors.ink, fontFamily: type.display, fontSize: 22 },
  deleteCopy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  deleteError: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    marginTop: spacing.md,
  },
  serverStamp: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 9,
    marginTop: spacing.xl,
  },
});
