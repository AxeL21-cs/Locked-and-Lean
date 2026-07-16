import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { BrandMark } from "../../components/BrandMark";
import { Screen } from "../../components/Screen";
import { type AppTheme, useAppTheme } from "../../design-system/theme";
import type { OAuthConsentDetails } from "../../services/supabase";
import { redirectDisplayLabel } from "./authorization";
import type { OAuthConsentGateway } from "./types";

const SCOPE_COPY = {
  openid: {
    label: "Sign-in identity",
    description: "Enables OpenID Connect and an ID token.",
    symbol: "ID",
  },
  email: {
    label: "Email identity",
    description: "Shares your email and whether it is verified.",
    symbol: "@",
  },
  profile: {
    label: "Basic profile",
    description:
      "Shares standard profile claims such as name or picture when present.",
    symbol: "O",
  },
  phone: {
    label: "Phone identity",
    description:
      "Shares your phone number and whether it is verified when present.",
    symbol: "#",
  },
} as const;

function ConsentCard({ details }: { details: OAuthConsentDetails }) {
  const styles = useOAuthStyles();
  return (
    <>
      <View style={styles.passport}>
        <View style={styles.passportTop}>
          <View style={styles.clientMark}>
            <Text style={styles.clientMarkText}>-&gt;</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>REGISTERED OAUTH CLIENT</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {details.client.name} wants to connect
            </Text>
          </View>
        </View>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>SIGNED IN AS</Text>
          <Text style={styles.identityValue}>{details.userEmail}</Text>
          <Text style={styles.verified}>FRESHLY VERIFIED WITH AUTH SERVER</Text>
        </View>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>RETURN DESTINATION</Text>
          <Text style={styles.identityValue}>
            {redirectDisplayLabel(details.redirectUri)}
          </Text>
        </View>
        <Text style={styles.clientId}>Client ID - {details.client.id}</Text>
      </View>
      <Text style={styles.sectionTitle}>Identity information requested</Text>
      <View style={styles.scopeList}>
        {details.supportedScopes.map((scope) => {
          const copy = SCOPE_COPY[scope];
          return (
            <View
              accessible
              accessibilityLabel={`${copy.label}. ${copy.description}`}
              key={scope}
              style={styles.scopeRow}
            >
              <Text style={styles.scopeSymbol}>{copy.symbol}</Text>
              <View style={styles.flex}>
                <Text style={styles.scopeTitle}>{copy.label}</Text>
                <Text style={styles.scopeDescription}>{copy.description}</Text>
                <Text style={styles.scopeCode}>OAuth scope: {scope}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <View accessibilityRole="summary" style={styles.boundaryCard}>
        <Text style={styles.boundaryLabel}>IMPORTANT PERMISSION BOUNDARY</Text>
        <Text style={styles.boundaryTitle}>These are identity scopes only</Text>
        <Text style={styles.boundaryCopy}>
          Supabase does not currently issue custom calorie, food, macro, or
          weight scopes. Approval does not create those permissions. RLS and a
          separate server-owned client/action policy still default-deny tool
          access.
        </Text>
      </View>
      {details.approvalBlockedReasons.length ? (
        <View accessibilityRole="alert" style={styles.blockedCard}>
          <Text style={styles.blockedTitle}>Approval blocked</Text>
          {details.approvalBlockedReasons.map((reason) => (
            <Text key={reason} style={styles.blockedReason}>
              ! {reason}
            </Text>
          ))}
          <Text style={styles.blockedCopy}>
            You can deny this request and return safely. No unsupported scope
            will be relabeled or approved.
          </Text>
        </View>
      ) : null}
    </>
  );
}

export function OAuthConsentBlocked({ reason }: { reason: string }) {
  const styles = useOAuthStyles();
  return (
    <Screen>
      <View style={styles.blockedStamp}>
        <Text style={styles.blockedStampText}>OAUTH CONSENT - DISABLED</Text>
      </View>
      <Text accessibilityRole="header" style={styles.blockedPageTitle}>
        Connection approval is blocked
      </Text>
      <Text style={styles.blockedPageCopy}>{reason}</Text>
      <View accessibilityRole="alert" style={styles.blockedCard}>
        <Text style={styles.blockedTitle}>No fallback authorization</Text>
        <Text style={styles.blockedCopy}>
          This screen will not simulate consent, accept a local authorization
          request, or broaden tool access. Hosted OAuth, token verification and
          server policy must be configured first.
        </Text>
      </View>
    </Screen>
  );
}

export function InvalidOAuthRequest() {
  return (
    <Screen>
      <AsyncStatePanel
        kind="error"
        message="The authorization_id is missing, duplicated, malformed, or was replaced by an unsafe return value. Start a new connection from the registered client."
        title="Invalid OAuth request"
      />
    </Screen>
  );
}

export function OAuthConsentFlow({
  authorizationId,
  gateway,
  onReauthenticate,
  onReturn,
}: {
  authorizationId: string;
  gateway: OAuthConsentGateway;
  onReauthenticate: () => void;
  onReturn: (redirectUrl: string) => Promise<void>;
}) {
  const styles = useOAuthStyles();
  const [decision, setDecision] = useState<"approve" | "deny">();
  const [decisionError, setDecisionError] = useState<unknown>();
  const [redirectUrl, setRedirectUrl] = useState<string>();
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<unknown>();
  const automaticReturn = useRef<string | undefined>(undefined);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [lookup, setLookup] = useState<{
    loading: boolean;
    data?: Awaited<ReturnType<OAuthConsentGateway["getDetails"]>>;
    error?: Error;
  }>({ loading: true });

  useEffect(() => {
    let active = true;
    void gateway.getDetails(authorizationId).then(
      (data) => {
        if (active) setLookup({ loading: false, data });
      },
      (error: unknown) => {
        if (active)
          setLookup({
            loading: false,
            error:
              error instanceof Error
                ? error
                : new Error("The OAuth request could not be verified."),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [authorizationId, gateway, lookupAttempt]);

  const returnToClient = async (url: string) => {
    setReturning(true);
    setReturnError(undefined);
    try {
      await onReturn(url);
    } catch (error) {
      setReturnError(error);
      setReturning(false);
    }
  };

  useEffect(() => {
    const url =
      lookup.data?.kind === "redirect" ? lookup.data.redirectUrl : undefined;
    if (!url || automaticReturn.current === url) return;
    automaticReturn.current = url;
    void onReturn(url).catch((error: unknown) => {
      setReturnError(error);
      setReturning(false);
    });
  }, [lookup.data, onReturn]);

  const decide = async (
    nextDecision: "approve" | "deny",
    details: OAuthConsentDetails,
  ) => {
    setDecision(nextDecision);
    setDecisionError(undefined);
    try {
      const url =
        nextDecision === "approve"
          ? await gateway.approve(details)
          : await gateway.deny(details);
      setRedirectUrl(url);
      await returnToClient(url);
    } catch (error) {
      setDecisionError(error);
      setDecision(undefined);
    }
  };

  if (lookup.loading)
    return (
      <Screen>
        <AsyncStatePanel
          kind="loading"
          message="Confirming your session and retrieving the registered client directly from Supabase Auth."
          title="Verifying connection request"
        />
      </Screen>
    );

  if (lookup.error)
    return (
      <Screen>
        <AsyncStatePanel
          actionLabel="Retry request"
          kind={
            /offline|network|fetch/i.test(lookup.error.message)
              ? "offline"
              : "error"
          }
          message={lookup.error.message}
          onAction={() => {
            setLookup({ loading: true });
            setLookupAttempt((attempt) => attempt + 1);
          }}
          title={
            /expired|unavailable|not found/i.test(lookup.error.message)
              ? "Request expired or unavailable"
              : "Could not verify consent request"
          }
        />
        {/auth|session|user/i.test(lookup.error.message) ? (
          <ActionButton label="Sign in again" onPress={onReauthenticate} />
        ) : null}
      </Screen>
    );

  const effectiveRedirectUrl =
    redirectUrl ??
    (lookup.data?.kind === "redirect" ? lookup.data.redirectUrl : undefined);
  if (effectiveRedirectUrl)
    return (
      <Screen>
        <AsyncStatePanel
          actionLabel={returnError ? "Retry secure return" : undefined}
          kind={returnError ? "error" : "loading"}
          message={
            returnError instanceof Error
              ? returnError.message
              : "Supabase Auth completed the request. Returning to the registered HTTPS client."
          }
          onAction={
            returnError
              ? () => void returnToClient(effectiveRedirectUrl)
              : undefined
          }
          title={returnError ? "Return was interrupted" : "Returning to client"}
        />
        {returning ? (
          <Text accessibilityLiveRegion="polite" style={styles.returningText}>
            Secure return in progress...
          </Text>
        ) : null}
      </Screen>
    );

  if (!lookup.data || lookup.data.kind !== "consent")
    return (
      <Screen>
        <AsyncStatePanel
          kind="error"
          message="Supabase Auth returned an unrecognized consent response."
          title="Consent request could not be displayed"
        />
      </Screen>
    );

  const details = lookup.data;
  return (
    <Screen>
      <View style={styles.brandRow}>
        <BrandMark size={56} showWordmark />
        <Text style={styles.brandMeta}>OAUTH 2.1 CONSENT</Text>
      </View>
      <ConsentCard details={details} />
      {decisionError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {decisionError instanceof Error
            ? decisionError.message
            : "The OAuth decision could not be completed."}
        </Text>
      ) : null}
      <ActionButton
        busy={decision === "approve"}
        disabled={
          Boolean(decision) || details.approvalBlockedReasons.length > 0
        }
        label="Approve identity connection"
        onPress={() => void decide("approve", details)}
        accessibilityHint="Approves only the standard identity scopes displayed above"
      />
      <ActionButton
        busy={decision === "deny"}
        disabled={Boolean(decision)}
        label="Deny and return"
        onPress={() => void decide("deny", details)}
        tone="secondary"
      />
      <Text style={styles.footnote}>
        Authorization request {details.authorizationId}. The app never receives
        or stores the client authorization code on this screen.
      </Text>
    </Screen>
  );
}

function useOAuthStyles() {
  const theme = useAppTheme();
  return useMemo(() => createStyles(theme), [theme]);
}

const createStyles = ({ colors, radius, spacing, type, typeScale }: AppTheme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    brandRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      justifyContent: "space-between",
      marginTop: spacing.md,
    },
    brandMeta: {
      color: colors.textFaint,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1.3,
    },
    passport: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderStrong,
      borderRadius: radius.xl,
      borderWidth: 1,
      marginTop: spacing.xl,
      overflow: "hidden",
      padding: spacing.xl,
    },
    passportTop: {
      alignItems: "flex-start",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    clientMark: {
      alignItems: "center",
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    clientMarkText: {
      color: colors.onBrand,
      fontFamily: type.display,
      fontSize: 21,
    },
    eyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1.5,
    },
    title: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 29,
      lineHeight: 34,
      marginTop: 4,
    },
    identityRow: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      marginTop: spacing.lg,
      paddingTop: spacing.md,
    },
    identityLabel: {
      color: colors.textMuted,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1.4,
    },
    identityValue: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: 12,
      marginTop: 3,
    },
    verified: {
      color: colors.success,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 0.7,
      marginTop: spacing.sm,
    },
    clientId: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: 11,
      marginTop: spacing.lg,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 24,
      marginTop: spacing.xl,
    },
    scopeList: { gap: spacing.sm, marginTop: spacing.md },
    scopeRow: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.lg,
    },
    scopeSymbol: {
      color: colors.brandStrong,
      fontFamily: type.display,
      fontSize: 20,
      textAlign: "center",
      width: 28,
    },
    scopeTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
    },
    scopeDescription: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 2,
    },
    scopeCode: {
      color: colors.textFaint,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 0.6,
      marginTop: spacing.sm,
    },
    boundaryCard: {
      backgroundColor: colors.infoContainer,
      borderColor: colors.info,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    boundaryLabel: {
      color: colors.info,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1.4,
    },
    boundaryTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 22,
      marginTop: spacing.xs,
    },
    boundaryCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 12,
      lineHeight: 18,
      marginTop: spacing.xs,
    },
    blockedCard: {
      backgroundColor: colors.dangerContainer,
      borderColor: colors.danger,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    blockedTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 22,
    },
    blockedReason: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      fontSize: 11,
      marginTop: spacing.sm,
    },
    blockedCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 12,
      lineHeight: 18,
      marginTop: spacing.sm,
    },
    error: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      fontSize: 12,
      lineHeight: 18,
      marginTop: spacing.md,
    },
    footnote: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: 11,
      lineHeight: 15,
      marginBottom: spacing.xl,
      marginTop: spacing.lg,
    },
    returningText: {
      color: colors.info,
      fontFamily: type.bodyStrong,
      fontSize: 12,
      marginTop: spacing.md,
    },
    blockedStamp: {
      alignSelf: "flex-start",
      borderColor: colors.danger,
      borderRadius: radius.sm,
      borderWidth: 2,
      marginTop: spacing.xl,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      transform: [{ rotate: "-1deg" }],
    },
    blockedStampText: {
      color: colors.danger,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1.2,
    },
    blockedPageTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 38,
      lineHeight: 43,
      marginTop: spacing.xl,
    },
    blockedPageCopy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 14,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
  });
