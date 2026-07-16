import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
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
import {
  mobileApi,
  type CalendarHistoryDay,
  type DayHistory,
  type HistoryDayEntry,
} from "../../src/services/supabase";
import { useSession } from "../../src/features/auth/SessionProvider";
import {
  cacheKeys,
  getCache,
  putCache,
} from "../../src/features/offline/offlineStore";

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
  const params = useLocalSearchParams<{ date?: string }>();
  const { session } = useSession();
  const ownerId = session?.user.id;
  const queryClient = useQueryClient();
  const today = TODAY();
  const initialDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;
  const [mode, setMode] = useState<HistoryViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
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
      let snapshots: CalendarHistoryDay[];
      try {
        snapshots = await mobileApi.getCalendarHistory(startDate, endDate);
        await putCache(
          ownerId!,
          cacheKeys.calendar(startDate, endDate),
          snapshots,
        );
      } catch (error) {
        const cached = await getCache<CalendarHistoryDay[]>(
          ownerId!,
          cacheKeys.calendar(startDate, endDate),
        );
        if (!cached) throw error;
        snapshots = cached.value;
      }
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
    queryFn: async () => {
      try {
        const value = await mobileApi.getDayHistory(selectedDate);
        await putCache(ownerId!, cacheKeys.day(selectedDate), value);
        return value;
      } catch (error) {
        const cached = await getCache<DayHistory>(
          ownerId!,
          cacheKeys.day(selectedDate),
        );
        if (cached) return cached.value;
        throw error;
      }
    },
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
        annotation="Every total comes from confirmed entries."
        eyebrow="History · Manila time"
        title="Your food history"
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
