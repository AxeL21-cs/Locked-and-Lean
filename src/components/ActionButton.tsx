import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

export function ActionButton({
  label,
  onPress,
  busy = false,
  disabled = false,
  tone = "primary",
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
  accessibilityHint?: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const blocked = busy || disabled;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={busy ? `${label}, in progress` : label}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy }}
      android_ripple={{ color: theme.isDark ? "#FFFFFF1F" : "#07182F1F" }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "secondary" && styles.secondary,
        tone === "danger" && styles.danger,
        blocked && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={
            tone === "secondary"
              ? theme.colors.text
              : tone === "danger"
                ? theme.colors.onDanger
                : theme.colors.onBrand
          }
        />
      ) : null}
      <Text
        style={[
          styles.label,
          tone === "secondary" && styles.secondaryLabel,
          tone === "danger" && styles.dangerLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles({ colors, elevation, radius, spacing, type }: AppTheme) {
  return StyleSheet.create({
    button: {
      alignItems: "center",
      backgroundColor: colors.brand,
      borderColor: colors.brand,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginTop: spacing.md,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      ...elevation.card,
    },
    secondary: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderStrong,
      elevation: 0,
      shadowOpacity: 0,
    },
    danger: { backgroundColor: colors.danger, borderColor: colors.danger },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
    label: {
      color: colors.onBrand,
      fontFamily: type.label,
      fontSize: 15,
      letterSpacing: 0.2,
      lineHeight: 20,
    },
    secondaryLabel: { color: colors.text },
    dangerLabel: { color: colors.onDanger },
  });
}
