import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../../design-system/theme";
import { useAppTheme } from "../../design-system/theme";
import { useSession } from "../auth/SessionProvider";
import { inputParams } from "./offlineStore";
import { useOfflineSync } from "./useOfflineSync";

export function SyncStatusBanner() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { session } = useSession();
  const { queue, online, syncing, retry } = useOfflineSync(session?.user.id);

  if (online && queue.length === 0) return null;

  const errors = queue.filter((item) => item.status === "error");
  const needsReview = queue.find(
    (item) => item.kind === "manual-input" && item.status === "needs_review",
  );
  const disabled = needsReview ? false : !online || syncing;
  const title = needsReview
    ? "Not logged · review required"
    : errors.length
      ? "Sync needs attention"
      : online
        ? "Syncing confirmed entries"
        : "Waiting to sync";

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.card,
        errors.length || needsReview ? styles.error : styles.waiting,
      ]}
    >
      <View style={styles.statusRail} />
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{online ? "SYNC QUEUE" : "OFFLINE"}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>
          {needsReview
            ? "The server preview differed from the offline snapshot, so automatic confirmation stopped safely."
            : `${queue.length} confirmed ${queue.length === 1 ? "entry" : "entries"} stored on this device with stable duplicate protection.`}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Retry food entry synchronization"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        android_ripple={{ color: theme.colors.brandContainer }}
        disabled={disabled}
        onPress={() => {
          if (needsReview && needsReview.kind === "manual-input") {
            router.push({
              pathname: "/manual-entry",
              params: {
                ...inputParams(needsReview.input),
                reviewKey: needsReview.idempotencyKey,
              },
            } as unknown as Href);
          } else void retry();
        }}
        style={({ pressed }) => [
          styles.retry,
          disabled && styles.retryDisabled,
          pressed && styles.retryPressed,
        ]}
      >
        <Text style={styles.retryText}>
          {needsReview ? "REVIEW" : syncing ? "SYNCING" : "RETRY"}
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = ({ colors, radius, spacing, type, typeScale }: AppTheme) =>
  StyleSheet.create({
    card: {
      alignItems: "center",
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
      overflow: "hidden",
      padding: spacing.md,
    },
    waiting: {
      backgroundColor: colors.brandContainer,
      borderColor: colors.brandStrong,
    },
    error: {
      backgroundColor: colors.dangerContainer,
      borderColor: colors.danger,
    },
    statusRail: {
      alignSelf: "stretch",
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      width: 4,
    },
    copy: { flex: 1, minWidth: 0 },
    eyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.8,
    },
    title: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      marginTop: 2,
    },
    body: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: 2,
    },
    retry: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      minWidth: 72,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
    },
    retryDisabled: { opacity: 0.45 },
    retryPressed: { opacity: 0.72 },
    retryText: {
      color: colors.text,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.5,
    },
  });
