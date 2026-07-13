import type { RuntimeConfig } from "../config/runtime.js";

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: ["header"];
}

export function protectedResourceMetadata(
  config: RuntimeConfig,
): ProtectedResourceMetadata | null {
  if (!config.publicBaseUrl || !config.authIssuer) return null;
  return {
    resource: config.publicBaseUrl,
    authorization_servers: [config.authIssuer],
    scopes_supported: [...config.standardScopes],
    bearer_methods_supported: ["header"],
  };
}
