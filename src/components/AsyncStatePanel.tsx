import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  colors,
  elevation,
  radius,
  spacing,
  type,
  typeScale,
} from "../design-system/tokens";

type StateKind = "empty" | "error" | "loading" | "offline";
type Props = {
  actionLabel?: string;
  kind: StateKind;
  message: string;
  onAction?: () => void;
  title: string;
};

const symbol = {
  empty: { android: "inbox", ios: "tray", web: "inbox" },
  error: {
    android: "error",
    ios: "exclamationmark.triangle.fill",
    web: "error",
  },
  loading: {
    android: "progress_activity",
    ios: "arrow.triangle.2.circlepath",
    web: "progress_activity",
  },
  offline: { android: "cloud_off", ios: "wifi.slash", web: "cloud_off" },
} as const;
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
        <View style={styles.symbolBox}>
          <SymbolView
            name={symbol[kind]}
            size={22}
            tintColor={kind === "error" ? colors.tomato : colors.ink}
          />
        </View>
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
          <Text style={styles.actionText}>{actionLabel}</Text>
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
    ...elevation.card,
  },
  errorPanel: {
    backgroundColor: colors.tomatoWash,
    borderColor: colors.tomato,
  },
  topline: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  symbolBox: {
    alignItems: "center",
    backgroundColor: colors.calamansiWash,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  status: {
    color: colors.inkFaint,
    flex: 1,
    fontFamily: type.label,
    fontSize: typeScale.caption,
    letterSpacing: 1,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: typeScale.title,
    lineHeight: 26,
    marginTop: spacing.md,
  },
  message: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: typeScale.bodySmall,
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
  actionText: { color: colors.rice, fontFamily: type.label, fontSize: 14 },
});
