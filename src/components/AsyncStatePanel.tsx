import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing, type } from "../design-system/tokens";

type StateKind = "empty" | "error" | "loading" | "offline";
type Props = {
  actionLabel?: string;
  kind: StateKind;
  message: string;
  onAction?: () => void;
  title: string;
};

const symbol: Record<StateKind, string> = {
  empty: "○",
  error: "!",
  loading: "…",
  offline: "↯",
};
const status: Record<StateKind, string> = {
  empty: "EMPTY",
  error: "ERROR",
  loading: "LOADING",
  offline: "OFFLINE",
};

export function AsyncStatePanel({
  actionLabel,
  kind,
  message,
  onAction,
  title,
}: Props) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={kind === "error" ? "alert" : "summary"}
      style={[styles.panel, kind === "error" && styles.errorPanel]}
    >
      <View style={styles.topline}>
        <Text style={styles.symbol}>{symbol[kind]}</Text>
        <Text style={styles.status}>{status[kind]}</Text>
        {kind === "loading" ? (
          <ActivityIndicator
            accessibilityLabel="Loading"
            color={colors.calamansiDeep}
            size="small"
          />
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityHint="Attempts the operation again"
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <Text style={styles.actionText}>↻ {actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  errorPanel: {
    backgroundColor: colors.tomatoWash,
    borderColor: colors.tomato,
  },
  topline: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  symbol: {
    color: colors.tomato,
    fontFamily: type.label,
    fontSize: 18,
    minWidth: 16,
  },
  status: {
    color: colors.inkFaint,
    flex: 1,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.7,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 24,
    marginTop: spacing.md,
  },
  message: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  action: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 52,
    minWidth: 132,
    paddingHorizontal: spacing.lg,
  },
  actionPressed: { opacity: 0.75 },
  actionText: { color: colors.rice, fontFamily: type.label, fontSize: 13 },
});
