import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { TokenVerificationErrorCode } from "./types.js";

export interface AuthenticationChallengeOptions {
  protectedResourceMetadataUrl: string;
  error: "invalid_token" | "insufficient_scope";
  description: string;
  scope?: string;
}

function quoteChallengeValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function createWwwAuthenticateChallenge(
  options: AuthenticationChallengeOptions,
): string {
  const parameters = [
    `resource_metadata=${quoteChallengeValue(options.protectedResourceMetadataUrl)}`,
    `error=${quoteChallengeValue(options.error)}`,
    `error_description=${quoteChallengeValue(options.description)}`,
  ];
  if (options.scope) {
    parameters.push(`scope=${quoteChallengeValue(options.scope)}`);
  }
  return `Bearer ${parameters.join(", ")}`;
}

export function challengeErrorForCode(
  code: TokenVerificationErrorCode,
): "invalid_token" | "insufficient_scope" {
  return code === "insufficient_scope" || code === "client_action_denied"
    ? "insufficient_scope"
    : "invalid_token";
}

export function createAuthenticationToolResult(
  options: AuthenticationChallengeOptions,
): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "Authentication or authorization is required for this tool.",
      },
    ],
    _meta: {
      "mcp/www_authenticate": [createWwwAuthenticateChallenge(options)],
    },
  };
}
