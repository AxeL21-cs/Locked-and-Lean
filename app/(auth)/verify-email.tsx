import { useMutation } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { ActionButton } from "../../src/components/ActionButton";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, spacing, type } from "../../src/design-system/tokens";
import { mobileApi } from "../../src/services/supabase";

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
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
const styles = StyleSheet.create({
  copy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.xl,
  },
  error: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    marginTop: spacing.md,
  },
  success: {
    color: colors.calamansiDeep,
    fontFamily: type.bodyStrong,
    marginTop: spacing.md,
  },
});
