import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../src/components/ActionButton";
import { AsyncStatePanel } from "../../src/components/AsyncStatePanel";
import { Field } from "../../src/components/Field";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { type AppTheme, useAppTheme } from "../../src/design-system/theme";
import {
  addLocalDateDays,
  buildWeek,
  localDateInManila,
} from "../../src/domain/history";
import { calendarDayView } from "../../src/features/calendar/viewModel";
import { zodResolver } from "../../src/features/forms/zodResolver";
import { ProgressDashboard } from "../../src/features/progress/ProgressDashboard";
import type {
  ProgressDashboardData,
  ProgressRangeDays,
} from "../../src/features/progress/types";
import { mobileApi } from "../../src/services/supabase";

const schema = z.object({
  weightKg: z
    .string()
    .trim()
    .refine(
      (candidate) => Number(candidate) >= 20 && Number(candidate) <= 500,
      "Weight must be between 20 and 500 kg.",
    ),
  measuredAt: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,
      "Use YYYY-MM-DDTHH:MM in Manila time.",
    ),
});
type Values = z.infer<typeof schema>;

const nowLocalInput = () => {
  const now = new Date();
  const date = localDateInManila(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return `${date}T${time}`;
};
const key = () => globalThis.crypto?.randomUUID?.() ?? `weight-${Date.now()}`;

export default function ProgressScreen() {
  const client = useQueryClient();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [rangeDays, setRangeDays] = useState<ProgressRangeDays>(30);
  const confirmationKey = useRef(key());
  const endDate = localDateInManila(new Date());
  const startDate = addLocalDateDays(endDate, -(rangeDays - 1));
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { weightKg: "", measuredAt: nowLocalInput() },
  });
  const weightMutation = useMutation({
    mutationFn: (values: Values) =>
      mobileApi.recordWeight(
        Number(values.weightKg),
        `${values.measuredAt}:00+08:00`,
        confirmationKey.current,
      ),
    onSuccess: async () => {
      confirmationKey.current = key();
      reset({ weightKg: "", measuredAt: nowLocalInput() });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["progress"] }),
        client.invalidateQueries({ queryKey: ["weights"] }),
        client.invalidateQueries({ queryKey: ["calendar-history"] }),
      ]);
    },
  });
  const query = useQuery({
    queryKey: ["progress", startDate, endDate],
    queryFn: async (): Promise<ProgressDashboardData> => {
      const [summary, nutrition, weight] = await Promise.all([
        mobileApi.getProgressSummary(startDate, endDate),
        mobileApi.getCalendarHistory(startDate, endDate),
        mobileApi.getWeightTrend(startDate, endDate),
      ]);
      const nutritionDays = nutrition.map((snapshot) => {
        const contract = buildWeek({
          localDate: snapshot.localDate,
          today: endDate,
        }).find((candidate) => candidate.localDate === snapshot.localDate);
        if (!contract)
          throw new Error(`Could not build Manila date ${snapshot.localDate}.`);
        return calendarDayView(contract, snapshot);
      });
      return {
        summary,
        nutritionDays,
        weightPoints: weight.points,
        weightTruncated: weight.truncated,
      };
    },
  });

  return (
    <Screen>
      <ScreenHeader
        annotation="Confirmed food and recorded weight only."
        eyebrow="Progress · Manila time"
        title="See the trend"
      />
      <View style={styles.form}>
        <Text style={styles.formTitle}>Log a measurement</Text>
        <Text style={styles.formCopy}>
          A failed retry keeps the same idempotency key. Missing weight days
          stay missing in the trend.
        </Text>
        <Controller
          control={control}
          name="weightKg"
          render={({ field }) => (
            <Field
              error={errors.weightKg?.message}
              keyboardType="decimal-pad"
              label="Weight (kg)"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <Controller
          control={control}
          name="measuredAt"
          render={({ field }) => (
            <Field
              error={errors.measuredAt?.message}
              hint="Manila local date and time, for example 2026-07-13T07:30"
              label="Measured at"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        {weightMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {weightMutation.error.message}
          </Text>
        ) : null}
        {weightMutation.isSuccess ? (
          <Text accessibilityLiveRegion="polite" style={styles.success}>
            Weight recorded. Trend refreshed from the server.
          </Text>
        ) : null}
        <ActionButton
          busy={weightMutation.isPending}
          label="Record weight"
          onPress={handleSubmit((values) => weightMutation.mutate(values))}
        />
      </View>
      {query.isLoading ? (
        <AsyncStatePanel
          kind="loading"
          message="Reading server-calculated nutrition summaries and recorded weight points."
          title="Building progress"
        />
      ) : null}
      {query.error ? (
        <AsyncStatePanel
          actionLabel="Retry trends"
          kind={
            /offline|network|fetch/i.test(query.error.message)
              ? "offline"
              : "error"
          }
          message={query.error.message}
          onAction={() => void query.refetch()}
          title="Progress is unavailable"
        />
      ) : null}
      {query.data &&
      query.data.summary.loggedDays === 0 &&
      query.data.weightPoints.length === 0 ? (
        <AsyncStatePanel
          kind="empty"
          message="Confirm food entries or record a weight to start. Missing dates remain explicit gaps."
          title="No progress points in this range"
        />
      ) : null}
      {query.data ? (
        <ProgressDashboard
          data={query.data}
          onRangeChange={setRangeDays}
          rangeDays={rangeDays}
        />
      ) : null}
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
    form: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.xl,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: 22,
      ...elevation.floating,
    },
    formTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.headline,
    },
    formCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    error: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      marginTop: spacing.md,
    },
    success: {
      color: colors.success,
      fontFamily: type.bodyStrong,
      marginTop: spacing.md,
    },
  });
