export const PROTECTED_ACTIONS = [
  "get_calendar_history",
  "get_day_history",
  "get_progress_summary",
  "get_weight_trend",
  "preview_food_log",
  "revise_food_log_preview",
  "confirm_food_log",
  "record_weight",
  "delete_food_entry",
] as const;

export type ProtectedAction = (typeof PROTECTED_ACTIONS)[number];

export interface VerifiedPrincipal {
  subject: string;
  clientId: string;
  scopes: readonly string[];
  issuer: string;
  audience: readonly string[];
  expiresAt: number;
  tokenId: string | null;
  accessToken: string;
}

export interface VerifyAccessTokenRequest {
  accessToken: string | null;
  action: ProtectedAction;
  requiredScopes: readonly string[];
}

export interface AccessTokenVerifier {
  readonly configured: boolean;
  verify(request: VerifyAccessTokenRequest): Promise<VerifiedPrincipal>;
}

export type TokenVerificationErrorCode =
  | "missing_token"
  | "verifier_not_configured"
  | "invalid_token"
  | "invalid_issuer"
  | "invalid_audience"
  | "invalid_time"
  | "missing_subject"
  | "invalid_role"
  | "missing_client_id"
  | "insufficient_scope"
  | "client_action_denied";

export class TokenVerificationError extends Error {
  constructor(
    readonly code: TokenVerificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TokenVerificationError";
  }
}

export class LockedTokenVerifier implements AccessTokenVerifier {
  readonly configured = false;

  async verify(_request: VerifyAccessTokenRequest): Promise<never> {
    throw new TokenVerificationError(
      "verifier_not_configured",
      "Token verification is not configured.",
    );
  }
}
