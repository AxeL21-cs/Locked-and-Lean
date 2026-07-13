import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from "jose";

import {
  TokenVerificationError,
  type AccessTokenVerifier,
  type ProtectedAction,
  type VerifiedPrincipal,
  type VerifyAccessTokenRequest,
} from "./types.js";

type VerificationKey = CryptoKey | Uint8Array | JWTVerifyGetKey;

export interface JwtTokenVerifierConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
  algorithms: readonly ("RS256" | "PS256" | "ES256")[];
  allowedClientActions: Readonly<Record<string, readonly ProtectedAction[]>>;
  expectedRole: "authenticated";
  clockToleranceSeconds?: number;
}

function parseScopes(payload: JWTPayload): string[] {
  const scope = payload.scope;
  if (typeof scope === "string") {
    return scope.split(/\s+/).filter(Boolean);
  }
  const scopes = payload.scopes;
  return Array.isArray(scopes)
    ? scopes.filter((value): value is string => typeof value === "string")
    : [];
}

function audiences(payload: JWTPayload): string[] {
  if (typeof payload.aud === "string") return [payload.aud];
  return Array.isArray(payload.aud) ? payload.aud : [];
}

function mapJoseError(error: unknown): TokenVerificationError {
  if (error instanceof joseErrors.JWTExpired) {
    return new TokenVerificationError("invalid_time", "Access token expired.");
  }
  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === "iss") {
      return new TokenVerificationError(
        "invalid_issuer",
        "Access token issuer is invalid.",
      );
    }
    if (error.claim === "aud") {
      return new TokenVerificationError(
        "invalid_audience",
        "Access token audience is invalid.",
      );
    }
    if (error.claim === "exp" || error.claim === "nbf") {
      return new TokenVerificationError(
        "invalid_time",
        "Access token time claims are invalid.",
      );
    }
  }
  return new TokenVerificationError(
    "invalid_token",
    "Access token verification failed.",
  );
}

export class JwtAccessTokenVerifier implements AccessTokenVerifier {
  readonly configured = true;
  private readonly key: JWTVerifyGetKey;
  private readonly tolerance: number;

  constructor(
    private readonly config: JwtTokenVerifierConfig,
    key?: VerificationKey,
  ) {
    this.key =
      typeof key === "function"
        ? key
        : key
          ? async () => key
          : createRemoteJWKSet(new URL(config.jwksUri));
    this.tolerance = config.clockToleranceSeconds ?? 30;
  }

  async verify(request: VerifyAccessTokenRequest): Promise<VerifiedPrincipal> {
    if (!request.accessToken) {
      throw new TokenVerificationError(
        "missing_token",
        "Bearer access token is required.",
      );
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(request.accessToken, this.key, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [...this.config.algorithms],
        clockTolerance: this.tolerance,
        requiredClaims: ["iss", "aud", "sub", "exp", "iat"],
      }));
    } catch (error) {
      throw mapJoseError(error);
    }

    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.exp !== "number" ||
      payload.exp <= now - this.tolerance ||
      (typeof payload.nbf === "number" && payload.nbf > now + this.tolerance) ||
      (typeof payload.iat === "number" && payload.iat > now + this.tolerance)
    ) {
      throw new TokenVerificationError(
        "invalid_time",
        "Access token time claims are invalid.",
      );
    }
    if (
      !payload.sub ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.sub,
      )
    ) {
      throw new TokenVerificationError(
        "missing_subject",
        "Access token subject must be a UUID.",
      );
    }

    if (payload.role !== this.config.expectedRole) {
      throw new TokenVerificationError(
        "invalid_role",
        "Access token role is invalid.",
      );
    }

    const clientId = payload.client_id;
    if (typeof clientId !== "string" || clientId.length === 0) {
      throw new TokenVerificationError(
        "missing_client_id",
        "Access token client_id is required.",
      );
    }

    const tokenScopes = parseScopes(payload);
    if (request.requiredScopes.some((scope) => !tokenScopes.includes(scope))) {
      throw new TokenVerificationError(
        "insufficient_scope",
        "Access token is missing a required standard scope.",
      );
    }
    if (!this.config.allowedClientActions[clientId]?.includes(request.action)) {
      throw new TokenVerificationError(
        "client_action_denied",
        "OAuth client is not authorized for this tool action.",
      );
    }

    const tokenAudiences = audiences(payload);
    if (
      tokenAudiences.length !== 1 ||
      tokenAudiences[0] !== this.config.audience
    ) {
      throw new TokenVerificationError(
        "invalid_audience",
        "Access token audience must exactly match this resource.",
      );
    }

    const resource = payload.resource;
    if (resource !== undefined && resource !== this.config.audience) {
      throw new TokenVerificationError(
        "invalid_audience",
        "Access token resource is invalid.",
      );
    }

    return {
      subject: payload.sub,
      clientId,
      scopes: tokenScopes,
      issuer: String(payload.iss),
      audience: tokenAudiences,
      expiresAt: payload.exp,
      tokenId:
        typeof payload.jti === "string"
          ? payload.jti
          : typeof payload.session_id === "string"
            ? payload.session_id
            : null,
      accessToken: request.accessToken,
    };
  }
}
