import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createHttpHandler } from "../src/app.js";
import { LockedTokenVerifier } from "../src/auth/types.js";
import { loadRuntimeConfig } from "../src/config/runtime.js";
import { LockedNutritionRepository } from "../src/repositories/types.js";

function runtime() {
  const config = loadRuntimeConfig({
    MCP_PUBLIC_BASE_URL: "https://mcp.example.test",
    MCP_AUTH_ISSUER: "https://auth.example.test",
    MCP_JWKS_URI: "https://auth.example.test/jwks.json",
    MCP_EXPECTED_AUDIENCE: "https://mcp.example.test",
    MCP_ALLOWED_CLIENT_ACTIONS: JSON.stringify({
      chatgpt: ["get_day_history"],
    }),
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  });
  const verifier = new LockedTokenVerifier();
  const repository = new LockedNutritionRepository();
  return {
    config,
    executionContext: (accessToken: string | null) => ({
      accessToken,
      protectedResourceMetadataUrl: config.protectedResourceMetadataUrl,
      verifier,
      repository,
      health: {
        authConfigured: config.authConfigured,
        repositoryConfigured: config.repositoryConfigured,
        productionReady: false as const,
        blockers: config.blockers,
      },
    }),
  };
}

async function withServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(createHttpHandler(runtime()));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("publishes canonical protected-resource metadata with standard scopes", () =>
  withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      resource: "https://mcp.example.test",
      authorization_servers: ["https://auth.example.test"],
      scopes_supported: ["openid"],
      bearer_methods_supported: ["header"],
    });
  }));

test("malformed bearer header returns HTTP 401 and RFC challenge", () =>
  withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Basic bad",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, 401);
    assert.match(
      response.headers.get("www-authenticate") ?? "",
      /^Bearer resource_metadata=/,
    );
  }));

test("health is honest, secret-free, and never production ready", () =>
  withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.doesNotMatch(text, /publishable-key|user-access-token/);
    const body = JSON.parse(text) as Record<string, unknown>;
    assert.equal(body.status, "degraded");
    assert.equal(body.production_ready, false);
  }));

test("accepts an MCP initialize request over Streamable HTTP", () =>
  withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "contract-test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      result?: { serverInfo?: { name?: string }; capabilities?: unknown };
    };
    assert.equal(body.result?.serverInfo?.name, "locked-and-lean-mcp");
    assert.ok(body.result?.capabilities);
  }));
