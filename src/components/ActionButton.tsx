import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing, type } from "../design-system/tokens";

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
  const blocked = busy || disabled;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={busy ? `${label}, in progress` : label}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy }}
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
          color={tone === "secondary" ? colors.ink : colors.rice}
        />
      ) : null}
      <Text
        style={[styles.label, tone === "secondary" && styles.secondaryLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  secondary: { backgroundColor: "transparent" },
  danger: { backgroundColor: "#9F2D17", borderColor: "#9F2D17" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  label: {
    color: colors.rice,
    fontFamily: type.label,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  secondaryLabel: { color: colors.ink },
});
