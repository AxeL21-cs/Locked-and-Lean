export const STANDARD_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "phone",
] as const;

export type StandardOAuthScope = (typeof STANDARD_OAUTH_SCOPES)[number];

const AUTHORIZATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeAuthorizationId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    if (value.length !== 1) return undefined;
    return normalizeAuthorizationId(value[0]);
  }
  if (typeof value !== "string" || !AUTHORIZATION_ID.test(value))
    return undefined;
  return value.toLowerCase();
}

export function oauthConsentRoute(value: unknown) {
  const authorizationId = normalizeAuthorizationId(value);
  return authorizationId
    ? {
        pathname: "/oauth/consent" as const,
        params: { authorization_id: authorizationId },
      }
    : undefined;
}

export function oauthLoginRoute(value: unknown) {
  const authorizationId = normalizeAuthorizationId(value);
  return authorizationId
    ? {
        pathname: "/(auth)" as const,
        params: { oauth_authorization_id: authorizationId },
      }
    : undefined;
}

export function splitRequestedScopes(scope: string) {
  const requested = [...new Set(scope.split(/\s+/).filter(Boolean))];
  const supported = requested.filter(
    (candidate): candidate is StandardOAuthScope =>
      (STANDARD_OAUTH_SCOPES as readonly string[]).includes(candidate),
  );
  const unsupported = requested.filter(
    (candidate) =>
      !(STANDARD_OAUTH_SCOPES as readonly string[]).includes(candidate),
  );
  return { supported, unsupported };
}

function parsedHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password)
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export function isSafeServerRedirect(
  redirectUrl: string,
  expectedRedirectUri?: string,
) {
  const returned = parsedHttpsUrl(redirectUrl);
  if (!returned || returned.hash) return false;
  if (!expectedRedirectUri) return true;
  const expected = parsedHttpsUrl(expectedRedirectUri);
  return Boolean(
    expected &&
    returned.origin === expected.origin &&
    returned.pathname === expected.pathname,
  );
}

export function redirectDisplayLabel(value: string) {
  const url = parsedHttpsUrl(value);
  return url ? `${url.hostname}${url.pathname}` : "Blocked redirect";
}
