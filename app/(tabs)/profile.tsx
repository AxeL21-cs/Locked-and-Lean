import { useMutation } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../src/components/ActionButton";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { PRODUCT } from "../../src/design-system/product";
import {
  colors,
  elevation,
  radius,
  spacing,
  type,
  typeScale,
} from "../../src/design-system/tokens";
import { useSession } from "../../src/features/auth/SessionProvider";
import { mobileApi } from "../../src/services/supabase";

export default function ProfileScreen() {
  const { session } = useSession();
  const router = useRouter();
  const logout = useMutation({ mutationFn: () => mobileApi.logout() });
  return (
    <Screen>
      <ScreenHeader
        eyebrow="Account · private"
        title="Profile"
        annotation="Targets, preferences, and session controls."
      />
      <View style={styles.identity}>
        <Text style={styles.monogram}>
          {(session?.user.email?.[0] ?? "L").toUpperCase()}
        </Text>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>
            {session?.user.email ?? "Signed-in account"}
          </Text>
          <Text style={styles.meta}>
            {PRODUCT.country} · metric · {PRODUCT.timezone}
          </Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardIndex}>01</Text>
        <Text style={styles.cardTitle}>Profile and targets</Text>
        <Text style={styles.cardBody}>
          Update adult formula inputs and review a newly proposed target before
          activation.
        </Text>
        <ActionButton
          label="Review baseline details"
          onPress={() => router.push("/onboarding" as Href)}
          tone="secondary"
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardIndex}>02</Text>
        <Text style={styles.cardTitle}>Account safety</Text>
        <Text style={styles.cardBody}>
          Signing out ends the local session. Account deletion is not offered
          yet because the coordinated storage cleanup and export workflow is not
          implemented.
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
        />
      </View>
      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>
          Interpret first · verify second · log third
        </Text>
        <Text style={styles.ruleBody}>
          Every food source must become a complete current preview. Only your
          explicit confirmation of that exact revision can make it permanent.
        </Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  monogram: {
    backgroundColor: colors.calamansi,
    borderColor: colors.ink,
    borderRadius: 28,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 20,
    overflow: "hidden",
    paddingVertical: 15,
    textAlign: "center",
    width: 56,
  },
  identityCopy: { flex: 1 },
  name: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 16 },
  meta: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: typeScale.label,
    lineHeight: 18,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.paperRaised,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
    ...elevation.card,
  },
  cardIndex: {
    color: colors.tomato,
    fontFamily: type.label,
    fontSize: typeScale.caption,
    letterSpacing: 0.7,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: typeScale.title,
    marginTop: spacing.xs,
  },
  cardBody: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: typeScale.bodySmall,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  error: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    marginTop: spacing.md,
  },
  ruleCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  ruleTitle: {
    color: colors.calamansi,
    fontFamily: type.display,
    fontSize: typeScale.title,
  },
  ruleBody: {
    color: colors.riceDark,
    fontFamily: type.body,
    fontSize: typeScale.bodySmall,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});
