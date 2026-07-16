import type { ComponentProps } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

type Props = ComponentProps<typeof TextInput> & {
  error?: string;
  label: string;
  hint?: string;
};

export function Field({ error, hint, label, ...input }: Props) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = createStyles(theme);
  const helpId = `${label.replace(/\s/g, "-")}-help`;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        aria-describedby={helpId}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.brand}
        style={[
          styles.input,
          input.multiline && styles.multiline,
          error && styles.errorInput,
        ]}
        {...input}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" id={helpId} style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text id={helpId} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles({ colors, radius, spacing, type, typeScale }: AppTheme) {
  return StyleSheet.create({
    wrap: { gap: spacing.xs, marginTop: spacing.md },
    label: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
    },
    input: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderStrong,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontFamily: type.body,
      fontSize: typeScale.body,
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    multiline: { minHeight: 92, textAlignVertical: "top" },
    errorInput: { borderColor: colors.danger, borderWidth: 2 },
    error: { color: colors.danger, fontFamily: type.bodyStrong, fontSize: 12 },
    hint: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
    },
  });
}
