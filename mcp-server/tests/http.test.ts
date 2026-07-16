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

async function withParsedBodyServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const handler = createHttpHandler(runtime());
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString("utf8");
    (request as typeof request & { body?: unknown }).body = text
      ? JSON.parse(text)
      : undefined;
    await handler(request, response);
  });
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
      resource_name: "Locked and Lean",
      resource_documentation: "https://mcp.example.test/",
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

test("accepts ChatGPT's JSON-only post-OAuth MCP request", () =>
  withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "post-oauth-test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      result?: { serverInfo?: { name?: string } };
    };
    assert.equal(body.result?.serverInfo?.name, "locked-and-lean-mcp");
  }));

test("does not override an unrelated Accept media type", () =>
  withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "text/html",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "unsupported-client", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 406);
  }));

test("accepts a platform-preparsed MCP request body", () =>
  withParsedBodyServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "preparsed-test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      result?: { serverInfo?: { name?: string } };
    };
    assert.equal(body.result?.serverInfo?.name, "locked-and-lean-mcp");
  }));

test("accepts a valid platform-parsed body with ChatGPT's text content type", () =>
  withParsedBodyServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "post-login-test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      result?: { serverInfo?: { name?: string } };
    };
    assert.equal(body.result?.serverInfo?.name, "locked-and-lean-mcp");
  }));

test("does not relabel an unrelated platform-parsed content type", () =>
  withParsedBodyServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/xml",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 6,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "wrong-media-test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 415);
  }));
