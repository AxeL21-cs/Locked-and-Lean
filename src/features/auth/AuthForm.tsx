import { zodResolver } from "../forms/zodResolver";
import { useMutation } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../components/ActionButton";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { PRODUCT } from "../../design-system/product";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { mobileApi } from "../../services/supabase";
import { oauthConsentRoute } from "../oauth/authorization";

type Mode = "login" | "register" | "reset" | "update";
const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});
type Values = z.infer<typeof schema>;

export function AuthForm({
  mode,
  oauthAuthorizationId,
}: {
  mode: Mode;
  oauthAuthorizationId?: string;
}) {
  const router = useRouter();
  const needsEmail = mode !== "update";
  const modeSchema =
    mode === "reset"
      ? schema.extend({ password: z.string() })
      : mode === "update"
        ? schema.extend({ email: z.string() })
        : schema;
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(modeSchema),
  });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (mode === "login")
        return mobileApi.login(values.email, values.password);
      if (mode === "register")
        return mobileApi.register(values.email, values.password);
      if (mode === "reset") return mobileApi.requestPasswordReset(values.email);
      return mobileApi.updatePassword(values.password);
    },
    onSuccess: (result, values) => {
      const consentRoute = oauthConsentRoute(oauthAuthorizationId);
      if (mode === "login" && consentRoute)
        router.replace(consentRoute as unknown as Href);
      if (mode === "register")
        router.replace({
          pathname: "/verify-email",
          params: { email: values.email },
        } as unknown as Href);
      if (mode === "update") router.replace("/" as Href);
    },
  });
  const copy = {
    login: [
      "WELCOME BACK",
      "Open your field log",
      "Sign in to view only your RLS-protected records.",
    ],
    register: [
      "START A PRIVATE LOG",
      "Create account",
      "Email verification is required before health data can sync.",
    ],
    reset: [
      "ACCOUNT RECOVERY",
      "Reset password",
      "We'll send a secure recovery link if the account is eligible.",
    ],
    update: [
      "ACCOUNT RECOVERY",
      "Choose a new password",
      "Use a unique password with at least eight characters.",
    ],
  }[mode];
  const submitLabel = {
    login: "Sign in",
    register: "Create account",
    reset: "Send recovery link",
    update: "Update password",
  }[mode];

  return (
    <Screen>
      <View style={styles.mark}>
        <Text style={styles.markText}>LL</Text>
      </View>
      <Text style={styles.eyebrow}>{copy[0]}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {copy[1]}
      </Text>
      <Text style={styles.intro}>{copy[2]}</Text>
      {mode === "login" && oauthAuthorizationId ? (
        <View accessibilityRole="summary" style={styles.oauthReturn}>
          <Text style={styles.oauthReturnTitle}>Connection sign-in</Text>
          <Text style={styles.oauthReturnCopy}>
            Sign in to return to the same verified OAuth request. Account
            creation and arbitrary return URLs are disabled in this flow.
          </Text>
        </View>
      ) : null}
      <View style={styles.form}>
        {needsEmail ? (
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Field
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email?.message}
                keyboardType="email-address"
                label="Email"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
        ) : null}
        {mode !== "reset" ? (
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Field
                autoCapitalize="none"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                error={errors.password?.message}
                label={mode === "update" ? "New password" : "Password"}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                secureTextEntry
                value={field.value}
              />
            )}
          />
        ) : null}
        {mutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {mutation.error.message}
          </Text>
        ) : null}
        {mutation.isSuccess && mode === "reset" ? (
          <Text accessibilityLiveRegion="polite" style={styles.success}>
            If an eligible account exists, a recovery email is on its way.
          </Text>
        ) : null}
        <ActionButton
          busy={mutation.isPending}
          label={submitLabel}
          onPress={handleSubmit((values) => mutation.mutate(values))}
        />
        {mode === "login" && !oauthAuthorizationId ? (
          <>
            <ActionButton
              label="Create an account"
              onPress={() => router.push("/register" as Href)}
              tone="secondary"
            />
            <ActionButton
              label="Forgot password"
              onPress={() => router.push("/reset-password" as Href)}
              tone="secondary"
            />
          </>
        ) : null}
        {mode !== "login" && mode !== "update" ? (
          <ActionButton
            label="Back to sign in"
            onPress={() => router.replace("/" as Href)}
            tone="secondary"
          />
        ) : null}
      </View>
      <Text style={styles.privacy}>
        {PRODUCT.name} uses a public Supabase project key and your signed-in
        session. A service-role key never belongs in this app.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.calamansi,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    marginTop: spacing.xl,
    width: 52,
  },
  markText: { color: colors.ink, fontFamily: type.display, fontSize: 18 },
  eyebrow: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 10,
    letterSpacing: 1.8,
    marginTop: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 42,
    letterSpacing: -1.5,
    lineHeight: 46,
    marginTop: spacing.xs,
  },
  intro: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  form: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  oauthReturn: {
    backgroundColor: colors.skyWash,
    borderColor: colors.inkRule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  oauthReturnTitle: {
    color: colors.ink,
    fontFamily: type.bodyStrong,
    fontSize: 13,
  },
  oauthReturnCopy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  error: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  success: {
    color: colors.calamansiDeep,
    fontFamily: type.bodyStrong,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  privacy: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
});
