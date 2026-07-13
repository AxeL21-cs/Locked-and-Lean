import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AsyncStatePanel } from "../../src/components/AsyncStatePanel";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import {
  addLocalDateDays,
  buildMonthGrid,
  buildWeek,
  formatLocalDate,
  localDateInManila,
  monthLabel,
  parseLocalDate,
} from "../../src/domain/history";
import {
  HistoryActionFlow,
  type HistoryActionGateway,
} from "../../src/features/calendar/HistoryActionFlow";
import { HistoryCalendar } from "../../src/features/calendar/HistoryCalendar";
import type {
  HistoryEntryView,
  HistoryViewMode,
} from "../../src/features/calendar/types";
import { calendarDayView } from "../../src/features/calendar/viewModel";
import { mobileApi, type HistoryDayEntry } from "../../src/services/supabase";

const TODAY = () => localDateInManila(new Date());

function shiftMonth(localDate: string, amount: number) {
  const { year, month } = parseLocalDate(localDate);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
  return formatLocalDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: 1,
  });
}

function serviceEntry(entry: HistoryEntryView): HistoryDayEntry {
  return {
    ...entry,
    items: entry.items.map((item) => ({
      ...item,
      foodProductId: item.foodProductId ?? null,
      providerIdentifier: item.providerIdentifier ?? null,
      providerVersion: item.providerVersion ?? null,
      providerRetrievedAt: item.providerRetrievedAt ?? null,
      marketCountryCode: item.marketCountryCode ?? null,
    })),
  };
}

const actionGateway: HistoryActionGateway = {
  copyToPreview: (entry, mealType, consumedAt) =>
    mobileApi.copyFoodEntryToPreview(entry.id, mealType, consumedAt),
  editToPreview: ({ entry, mealType, consumedAt, originalDescription }) =>
    mobileApi.createFoodEntryEditPreview({
      entry: serviceEntry(entry),
      mealType,
      consumedAt,
      originalDescription,
    }),
  confirm: (previewId, revision, confirmationKey) =>
    mobileApi.confirmFoodPreview(previewId, revision, confirmationKey),
};

export default function CalendarScreen() {
  const queryClient = useQueryClient();
  const today = TODAY();
  const [mode, setMode] = useState<HistoryViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [historyAction, setHistoryAction] = useState<{
    action: "copy" | "edit";
    entry: HistoryEntryView;
  }>();

  const contracts = useMemo(() => {
    if (mode === "month") {
      const { year, month } = parseLocalDate(anchorDate);
      return buildMonthGrid({ year, month, today });
    }
    if (mode === "week") return buildWeek({ localDate: anchorDate, today });
    const day = buildWeek({ localDate: anchorDate, today }).find(
      (candidate) => candidate.localDate === anchorDate,
    );
    if (!day) throw new Error("Could not build the selected Manila day.");
    return [day];
  }, [anchorDate, mode, today]);
  const startDate = contracts[0]!.localDate;
  const endDate = contracts[contracts.length - 1]!.localDate;

  const calendarQuery = useQuery({
    queryKey: ["calendar-history", startDate, endDate],
    queryFn: async () => {
      const snapshots = await mobileApi.getCalendarHistory(startDate, endDate);
      const byDate = new Map(
        snapshots.map((snapshot) => [snapshot.localDate, snapshot]),
      );
      return contracts.map((contract) => {
        const snapshot = byDate.get(contract.localDate);
        if (!snapshot)
          throw new Error(
            `Server history is missing Manila date ${contract.localDate}.`,
          );
        return calendarDayView(contract, snapshot);
      });
    },
  });
  const dayQuery = useQuery({
    queryKey: ["day-history", selectedDate],
    queryFn: () => mobileApi.getDayHistory(selectedDate),
  });
  const remove = useMutation({
    mutationFn: (entry: HistoryEntryView) =>
      mobileApi.deleteFoodEntry(entry.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar-history"] }),
        queryClient.invalidateQueries({ queryKey: ["day-history"] }),
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
        queryClient.invalidateQueries({ queryKey: ["today"] }),
      ]);
    },
  });

  const periodLabel = useMemo(() => {
    if (mode === "month") {
      const { year, month } = parseLocalDate(anchorDate);
      return monthLabel(year, month);
    }
    if (mode === "week") return `${startDate} – ${endDate}`;
    return contracts[0]!.accessibilityLabel;
  }, [anchorDate, contracts, endDate, mode, startDate]);

  const movePeriod = (amount: -1 | 1) => {
    const next =
      mode === "month"
        ? shiftMonth(anchorDate, amount)
        : addLocalDateDays(anchorDate, amount * (mode === "week" ? 7 : 1));
    setAnchorDate(next);
    setSelectedDate(next);
  };
  const goToday = () => {
    const next = TODAY();
    setAnchorDate(next);
    setSelectedDate(next);
  };
  const finishAction = async () => {
    setHistoryAction(undefined);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-history"] }),
      queryClient.invalidateQueries({ queryKey: ["day-history"] }),
      queryClient.invalidateQueries({ queryKey: ["progress"] }),
      queryClient.invalidateQueries({ queryKey: ["today"] }),
    ]);
  };

  if (historyAction)
    return (
      <Screen>
        <HistoryActionFlow
          action={historyAction.action}
          entry={historyAction.entry}
          gateway={actionGateway}
          onCancel={() => setHistoryAction(undefined)}
          onDone={() => void finishAction()}
        />
      </Screen>
    );

  if (calendarQuery.isLoading || dayQuery.isLoading)
    return (
      <Screen>
        <AsyncStatePanel
          kind="loading"
          message="Reading confirmed server snapshots for the selected Manila dates."
          title="Opening history"
        />
      </Screen>
    );

  const error = calendarQuery.error ?? dayQuery.error;
  if (error)
    return (
      <Screen>
        <AsyncStatePanel
          actionLabel="Retry history"
          kind={
            /offline|network|fetch/i.test(error.message) ? "offline" : "error"
          }
          message={error.message}
          onAction={() => {
            void calendarQuery.refetch();
            void dayQuery.refetch();
          }}
          title="History is unavailable"
        />
      </Screen>
    );

  return (
    <Screen>
      <ScreenHeader
        annotation="Confirmed server snapshots"
        eyebrow="HISTORY · ASIA/MANILA"
        title="Calendar ledger"
      />
      <HistoryCalendar
        days={calendarQuery.data!}
        deleteError={remove.error?.message}
        deleting={remove.isPending}
        mode={mode}
        onCopy={(entry) => setHistoryAction({ action: "copy", entry })}
        onDelete={(entry) => remove.mutateAsync(entry).then(() => undefined)}
        onEdit={(entry) => setHistoryAction({ action: "edit", entry })}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setAnchorDate(selectedDate);
        }}
        onNext={() => movePeriod(1)}
        onPrevious={() => movePeriod(-1)}
        onSelectDate={setSelectedDate}
        onToday={goToday}
        periodLabel={periodLabel}
        selectedDate={selectedDate}
        selectedDayHistory={dayQuery.data!}
      />
    </Screen>
  );
}
