export type PublicEnvironment = {
  oauthConsentMode?: string;
  productName: string;
  supabasePublishableKey?: string;
  supabaseUrl?: string;
};

const clean = (value: string | undefined) => value?.trim() || undefined;

export const publicEnvironment: PublicEnvironment = Object.freeze({
  oauthConsentMode: clean(process.env.EXPO_PUBLIC_OAUTH_CONSENT_MODE),
  productName: clean(process.env.EXPO_PUBLIC_PRODUCT_NAME) ?? "Locked and Lean",
  supabasePublishableKey: clean(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
});

export type OAuthConsentReadiness =
  { enabled: true } | { enabled: false; reason: string };

export function getOAuthConsentReadiness(): OAuthConsentReadiness {
  if (publicEnvironment.oauthConsentMode !== "hosted") {
    return {
      enabled: false,
      reason:
        "OAuth consent is disabled in this build. A hosted OAuth Server deployment must be explicitly configured before consent can be used.",
    };
  }
  const { supabaseUrl, supabasePublishableKey } = publicEnvironment;
  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      enabled: false,
      reason:
        "OAuth consent is blocked because the hosted Supabase public configuration is incomplete.",
    };
  }
  try {
    const url = new URL(supabaseUrl);
    const local =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";
    if (url.protocol !== "https:" || local) {
      return {
        enabled: false,
        reason:
          "OAuth consent requires an HTTPS hosted Supabase project; local or insecure endpoints are blocked.",
      };
    }
  } catch {
    return {
      enabled: false,
      reason: "OAuth consent is blocked because the Supabase URL is invalid.",
    };
  }
  return { enabled: true };
}

export function getSupabasePublicConfiguration() {
  const { supabasePublishableKey, supabaseUrl } = publicEnvironment;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase is not configured for this build. Add the public project URL and publishable key, then retry.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error("The configured Supabase project URL is invalid.");
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Supabase must use HTTPS outside local development.");
  }

  return { publishableKey: supabasePublishableKey, url: supabaseUrl };
}
