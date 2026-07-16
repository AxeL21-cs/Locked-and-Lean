import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

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
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = createStyles(theme);
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
            tintColor={kind === "error" ? colors.danger : colors.text}
          />
        </View>
        <Text style={styles.status}>{status[kind]}</Text>
        {kind === "loading" ? (
          <ActivityIndicator
            accessibilityLabel="Loading"
            color={colors.brandStrong}
            size="small"
          />
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityHint="Attempts the operation again"
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          android_ripple={{ color: theme.isDark ? "#FFFFFF1F" : "#07182F1F" }}
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

function createStyles({
  colors,
  elevation,
  radius,
  spacing,
  type,
  typeScale,
}: AppTheme) {
  return StyleSheet.create({
    panel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
      ...elevation.card,
    },
    errorPanel: {
      backgroundColor: colors.dangerContainer,
      borderColor: colors.danger,
    },
    topline: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
    symbolBox: {
      alignItems: "center",
      backgroundColor: colors.brandContainer,
      borderRadius: radius.pill,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    status: {
      color: colors.textFaint,
      flex: 1,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1,
    },
    title: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.title,
      lineHeight: 26,
      marginTop: spacing.md,
    },
    message: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    action: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.brand,
      borderRadius: radius.md,
      justifyContent: "center",
      marginTop: spacing.lg,
      minHeight: 52,
      minWidth: 132,
      paddingHorizontal: spacing.lg,
    },
    actionPressed: { opacity: 0.75 },
    actionText: { color: colors.onBrand, fontFamily: type.label, fontSize: 14 },
  });
}
