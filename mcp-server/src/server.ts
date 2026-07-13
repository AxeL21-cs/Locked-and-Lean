import { createServer } from "node:http";

import { createHttpHandler } from "./app.js";
import { JwtAccessTokenVerifier } from "./auth/tokenVerifier.js";
import { LockedTokenVerifier } from "./auth/types.js";
import { loadRuntimeConfig } from "./config/runtime.js";
import { SupabaseRpcRepository } from "./repositories/supabaseRpcRepository.js";
import { LockedNutritionRepository } from "./repositories/types.js";

export function buildRuntime() {
  const config = loadRuntimeConfig();
  const verifier =
    config.authConfigured &&
    config.authIssuer &&
    config.expectedAudience &&
    config.jwksUri
      ? new JwtAccessTokenVerifier({
          issuer: config.authIssuer,
          audience: config.expectedAudience,
          jwksUri: config.jwksUri,
          algorithms: config.algorithms,
          allowedClientActions: config.allowedClientActions,
          expectedRole: config.expectedRole,
        })
      : new LockedTokenVerifier();
  const repository =
    config.repositoryConfigured &&
    config.supabaseUrl &&
    config.supabasePublishableKey
      ? new SupabaseRpcRepository({
          supabaseUrl: config.supabaseUrl,
          publishableKey: config.supabasePublishableKey,
        })
      : new LockedNutritionRepository();

  return {
    config,
    executionContext: (accessToken: string | null) => ({
      accessToken,
      protectedResourceMetadataUrl: config.protectedResourceMetadataUrl,
      verifier,
      repository,
      health: {
        authConfigured: verifier.configured,
        repositoryConfigured: repository.configured,
        productionReady: false as const,
        blockers: config.blockers,
      },
    }),
  };
}

if (process.env.NODE_ENV !== "test") {
  const runtime = buildRuntime();
  const server = createServer(createHttpHandler(runtime));
  server.listen(runtime.config.port, "127.0.0.1", () => {
    process.stdout.write(
      `Locked and Lean MCP listening on http://127.0.0.1:${runtime.config.port}\n`,
    );
  });
}
