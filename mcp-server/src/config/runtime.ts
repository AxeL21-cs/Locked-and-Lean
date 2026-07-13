import { PROTECTED_ACTIONS, type ProtectedAction } from "../auth/types.js";

const ACTION_SET = new Set<string>(PROTECTED_ACTIONS);
const ASYMMETRIC_ALGORITHMS = new Set(["RS256", "PS256", "ES256"] as const);

export interface RuntimeConfig {
  port: number;
  publicBaseUrl: string | null;
  protectedResourceMetadataUrl: string | null;
  authIssuer: string | null;
  jwksUri: string | null;
  expectedAudience: string | null;
  expectedRole: "authenticated";
  algorithms: readonly ("RS256" | "PS256" | "ES256")[];
  standardScopes: readonly ["openid"];
  allowedClientActions: Readonly<Record<string, readonly ProtectedAction[]>>;
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  authConfigured: boolean;
  repositoryConfigured: boolean;
  protectedToolsConfigured: boolean;
  productionReady: false;
  blockers: readonly string[];
}

function httpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? "8787");
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535
    ? parsed
    : 8787;
}

function parseAlgorithms(
  value: string | undefined,
): ("RS256" | "PS256" | "ES256")[] {
  const requested = (value ?? "RS256,ES256")
    .split(",")
    .map((algorithm) => algorithm.trim())
    .filter(Boolean);
  const algorithms = requested.filter(
    (algorithm): algorithm is "RS256" | "PS256" | "ES256" =>
      ASYMMETRIC_ALGORITHMS.has(algorithm as "RS256" | "PS256" | "ES256"),
  );
  return [...new Set(algorithms)];
}

function parseAllowedClientActions(
  value: string | undefined,
): Readonly<Record<string, readonly ProtectedAction[]>> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const result: Record<string, ProtectedAction[]> = {};
    for (const [clientId, actions] of Object.entries(parsed)) {
      if (!clientId.trim() || !Array.isArray(actions)) return {};
      const valid = actions.filter(
        (action): action is ProtectedAction =>
          typeof action === "string" && ACTION_SET.has(action),
      );
      if (valid.length !== actions.length || valid.length === 0) return {};
      result[clientId] = [...new Set(valid)];
    }
    return result;
  } catch {
    return {};
  }
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const blockers: string[] = [];
  const publicBaseUrl = httpsOrigin(env.MCP_PUBLIC_BASE_URL);
  const authIssuer = httpsOrigin(env.MCP_AUTH_ISSUER);
  const jwksUri = httpsUrl(env.MCP_JWKS_URI);
  const configuredAudience = httpsOrigin(env.MCP_EXPECTED_AUDIENCE);
  const expectedAudience = configuredAudience ?? publicBaseUrl;
  const algorithms = parseAlgorithms(env.MCP_AUTH_ALGORITHMS);
  const allowedClientActions = parseAllowedClientActions(
    env.MCP_ALLOWED_CLIENT_ACTIONS,
  );
  const supabaseUrl = httpsOrigin(env.SUPABASE_URL);
  const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim() || null;

  if (!publicBaseUrl) blockers.push("missing_https_public_base_url");
  if (!authIssuer) blockers.push("missing_https_auth_issuer");
  if (!jwksUri) blockers.push("missing_https_jwks_uri");
  if (!expectedAudience || expectedAudience !== publicBaseUrl) {
    blockers.push("audience_must_equal_canonical_resource");
  }
  if (algorithms.length === 0)
    blockers.push("missing_asymmetric_jwt_algorithm");
  if (Object.keys(allowedClientActions).length === 0) {
    blockers.push("missing_client_action_policy");
  }
  if (!supabaseUrl) blockers.push("missing_https_supabase_url");
  if (!supabasePublishableKey)
    blockers.push("missing_supabase_publishable_key");

  const authConfigured =
    Boolean(publicBaseUrl && authIssuer && jwksUri) &&
    expectedAudience === publicBaseUrl &&
    algorithms.length > 0 &&
    Object.keys(allowedClientActions).length > 0;
  const repositoryConfigured = Boolean(supabaseUrl && supabasePublishableKey);

  blockers.push(
    "supabase_custom_application_scopes_unavailable",
    "hosted_oauth_and_mcp_inspector_unverified",
  );

  return {
    port: parsePort(env.PORT),
    publicBaseUrl,
    protectedResourceMetadataUrl: publicBaseUrl
      ? `${publicBaseUrl}/.well-known/oauth-protected-resource`
      : null,
    authIssuer,
    jwksUri,
    expectedAudience,
    expectedRole: "authenticated",
    algorithms,
    standardScopes: ["openid"],
    allowedClientActions,
    supabaseUrl,
    supabasePublishableKey,
    authConfigured,
    repositoryConfigured,
    protectedToolsConfigured: authConfigured && repositoryConfigured,
    productionReady: false,
    blockers,
  };
}
