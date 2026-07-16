import { useMutation } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";

import { ActionButton } from "../../src/components/ActionButton";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { type AppTheme, useAppTheme } from "../../src/design-system/theme";
import { mobileApi } from "../../src/services/supabase";

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resend = useMutation({
    mutationFn: () => mobileApi.resendVerification(email ?? ""),
  });
  return (
    <Screen>
      <ScreenHeader
        eyebrow="ONE MORE STEP"
        title="Check your email"
        annotation="Verification required"
      />
      <Text style={styles.copy}>
        Open the verification link sent to {email || "your email address"}.
        After verification, return here and sign in.
      </Text>
      {resend.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {resend.error.message}
        </Text>
      ) : null}
      {resend.isSuccess ? (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          Verification email sent again.
        </Text>
      ) : null}
      <ActionButton
        busy={resend.isPending}
        disabled={!email}
        label="Resend verification email"
        onPress={() => resend.mutate()}
      />
      <ActionButton
        label="Back to sign in"
        onPress={() => router.replace("/" as Href)}
        tone="secondary"
      />
    </Screen>
  );
}
const createStyles = ({ colors, spacing, type, typeScale }: AppTheme) =>
  StyleSheet.create({
    copy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.body,
      lineHeight: 24,
      marginTop: spacing.xl,
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
