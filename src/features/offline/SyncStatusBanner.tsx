import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";

import { colors, radius, spacing, type } from "../../design-system/tokens";
import { useSession } from "../auth/SessionProvider";
import { useOfflineSync } from "./useOfflineSync";
import { inputParams } from "./offlineStore";

export function SyncStatusBanner() {
  const router = useRouter();
  const { session } = useSession();
  const { queue, online, syncing, retry } = useOfflineSync(session?.user.id);
  if (online && queue.length === 0) return null;
  const errors = queue.filter((item) => item.status === "error");
  const needsReview = queue.find(
    (item) => item.kind === "manual-input" && item.status === "needs_review",
  );
  return (
    <View
      accessibilityRole="alert"
      style={[styles.card, errors.length ? styles.error : styles.waiting]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>
          {needsReview
            ? "Not logged · review required"
            : errors.length
              ? "Sync needs attention"
              : online
                ? "Syncing confirmed entries"
                : "Waiting to sync"}
        </Text>
        <Text style={styles.body}>
          {needsReview
            ? "The server preview differed from the offline snapshot, so automatic confirmation stopped safely."
            : `${queue.length} confirmed ${queue.length === 1 ? "entry" : "entries"} stored on this device with stable duplicate protection.`}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Retry food entry synchronization"
        accessibilityRole="button"
        disabled={needsReview ? false : !online || syncing}
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
        style={styles.retry}
      >
        <Text style={styles.retryText}>
          {needsReview ? "REVIEW" : syncing ? "SYNCING" : "RETRY"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  waiting: {
    backgroundColor: colors.calamansiWash,
    borderColor: colors.calamansiDeep,
  },
  error: { backgroundColor: colors.tomatoWash, borderColor: colors.tomato },
  copy: { flex: 1 },
  title: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 14 },
  body: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  retry: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: spacing.sm,
  },
  retryText: { color: colors.ink, fontFamily: type.label, fontSize: 12 },
});
