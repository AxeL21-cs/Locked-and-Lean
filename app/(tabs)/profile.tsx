import { useMutation } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../src/components/ActionButton";
import { BrandMark } from "../../src/components/BrandMark";
import { ChoiceChips } from "../../src/components/ChoiceChips";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { PRODUCT } from "../../src/design-system/product";
import type {
  AppTheme,
  AppThemePreference,
} from "../../src/design-system/theme";
import { useAppTheme } from "../../src/design-system/theme";
import { useSession } from "../../src/features/auth/SessionProvider";
import { mobileApi } from "../../src/services/supabase";

const appearanceChoices = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const satisfies readonly {
  label: string;
  value: AppThemePreference;
}[];

export default function ProfileScreen() {
  const { session } = useSession();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const logout = useMutation({ mutationFn: () => mobileApi.logout() });

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Private account · Manila"
        title="Your setup"
        annotation="Targets, appearance, and session controls."
      />

      <View style={styles.identity}>
        <BrandMark decorative size={56} />
        <View style={styles.identityCopy}>
          <Text style={styles.accountLabel}>SIGNED-IN ACCOUNT</Text>
          <Text selectable style={styles.name}>
            {session?.user.email ?? "Signed-in account"}
          </Text>
          <Text style={styles.meta}>
            {PRODUCT.country} · metric · {PRODUCT.timezone}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Preferences
        </Text>
        <Text style={styles.sectionIndex}>01</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>DAILY BASELINE</Text>
        <Text style={styles.cardTitle}>Profile and targets</Text>
        <Text style={styles.cardBody}>
          Update your adult formula inputs, then review a newly proposed target
          before activating it.
        </Text>
        <ActionButton
          label="Review baseline details"
          onPress={() => router.push("/onboarding" as Href)}
          tone="secondary"
        />
      </View>

      <View style={styles.appearance}>
        <View style={styles.appearanceCopy}>
          <Text style={styles.cardEyebrow}>APPEARANCE</Text>
          <Text style={styles.appearanceTitle}>Choose your theme</Text>
          <Text style={styles.cardBody}>
            System follows your Android display setting. A light or dark choice
            stays selected when you reopen the app.
          </Text>
          <ChoiceChips
            choices={appearanceChoices}
            label="Theme preference"
            onChange={theme.setPreference}
            value={theme.preference}
          />
        </View>
        <View style={styles.systemBadge}>
          <View style={styles.systemDot} />
          <Text style={styles.systemText}>
            CURRENTLY {theme.colorScheme.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Account safety
        </Text>
        <Text style={styles.sectionIndex}>02</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session controls</Text>
        <Text style={styles.cardBody}>
          Signing out ends the local session. Account deletion stays unavailable
          until coordinated export and storage cleanup are implemented.
        </Text>
        {logout.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {logout.error.message}
          </Text>
        ) : null}
        <ActionButton
          busy={logout.isPending}
          label="Sign out"
          onPress={() => logout.mutate()}
          tone="secondary"
        />
      </View>

      <View style={styles.ruleCard}>
        <Text style={styles.ruleLabel}>THE LOCKED RULE</Text>
        <Text style={styles.ruleTitle}>
          Interpret first. Verify second. Log third.
        </Text>
        <Text style={styles.ruleBody}>
          Every food source becomes a complete current preview. Only your
          explicit confirmation of that exact revision can make it permanent.
        </Text>
      </View>
    </Screen>
  );
}

const createStyles = ({
  colors,
  elevation,
  isDark,
  radius,
  spacing,
  type,
  typeScale,
}: AppTheme) =>
  StyleSheet.create({
    identity: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.md,
      marginTop: spacing.xl,
      padding: spacing.md,
      ...elevation.card,
    },
    identityCopy: { flex: 1, minWidth: 0 },
    accountLabel: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.8,
    },
    name: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 23,
      marginTop: 3,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.label,
      lineHeight: 19,
      marginTop: 4,
    },
    sectionHead: {
      alignItems: "flex-end",
      borderBottomColor: colors.borderStrong,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.title,
      lineHeight: 28,
    },
    sectionIndex: {
      color: colors.brandStrong,
      fontFamily: type.numeric,
      fontSize: typeScale.label,
      letterSpacing: 0.7,
    },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing.lg,
      ...elevation.card,
    },
    cardEyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.8,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.title,
      lineHeight: 28,
      marginTop: spacing.xs,
    },
    cardBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    appearance: {
      alignItems: "flex-start",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
      padding: spacing.lg,
    },
    appearanceCopy: { flex: 1, minWidth: 0 },
    appearanceTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 23,
      marginTop: spacing.xs,
    },
    systemBadge: {
      alignItems: "center",
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 36,
      paddingHorizontal: spacing.sm,
    },
    systemDot: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    systemText: {
      color: colors.textMuted,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.6,
    },
    error: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      marginTop: spacing.md,
    },
    ruleCard: {
      backgroundColor: isDark ? colors.surfaceRaised : colors.text,
      borderRadius: radius.xl,
      marginBottom: spacing.xl,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    ruleLabel: {
      color: colors.brand,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1.1,
    },
    ruleTitle: {
      color: isDark ? colors.text : colors.background,
      fontFamily: type.display,
      fontSize: typeScale.title,
      lineHeight: 28,
      marginTop: spacing.sm,
    },
    ruleBody: {
      color: isDark ? colors.textMuted : colors.surfaceMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
  });
