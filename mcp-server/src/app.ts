import type { IncomingMessage, ServerResponse } from "node:http";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createWwwAuthenticateChallenge } from "./auth/challenge.js";
import type { RuntimeConfig } from "./config/runtime.js";
import { protectedResourceMetadata } from "./http/protectedResource.js";
import { TOOL_DEFINITIONS } from "./tools/catalog.js";
import { executeTool, type ToolExecutionContext } from "./tools/execute.js";

type JsonObjectSchema = {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
};

export interface AppDependencies {
  config: RuntimeConfig;
  executionContext(accessToken: string | null): ToolExecutionContext;
}

function objectJsonSchema(schema: z.ZodType): JsonObjectSchema {
  const json = z.toJSONSchema(schema, { target: "draft-7" });
  if (!json || json.type !== "object") {
    throw new Error("Tool schemas must serialize to JSON object schemas.");
  }
  return json as JsonObjectSchema;
}

export function toolDescriptors(): ListToolsResult["tools"] {
  return TOOL_DEFINITIONS.map((definition) => ({
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: objectJsonSchema(definition.inputSchema),
    outputSchema: objectJsonSchema(definition.outputSchema),
    annotations: { title: definition.title, ...definition.annotations },
    securitySchemes: definition.securitySchemes,
    _meta: {
      securitySchemes: definition.securitySchemes,
      "openai/toolInvocation/invoking": definition.status.invoking,
      "openai/toolInvocation/invoked": definition.status.invoked,
    },
  })) as ListToolsResult["tools"];
}

export function createProtocolServer(context: ToolExecutionContext): Server {
  const server = new Server(
    { name: "locked-and-lean-mcp", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Interpret first, verify second, log third. Never confirm a food log until the complete current preview revision has been shown and explicitly confirmed.",
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDescriptors(),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    executeTool(request.params.name, request.params.arguments ?? {}, context),
  );
  return server;
}

function json(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function accessToken(
  request: IncomingMessage,
): { kind: "none" } | { kind: "valid"; token: string } | { kind: "malformed" } {
  const header = request.headers.authorization;
  if (header === undefined) return { kind: "none" };
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  return match?.[1]
    ? { kind: "valid", token: match[1] }
    : { kind: "malformed" };
}

function methodNotAllowed(response: ServerResponse): void {
  json(response, 405, {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
}

function normalizeMcpPostAcceptHeader(request: IncomingMessage): void {
  const accept = request.headers.accept?.toLowerCase().trim();
  if (
    !accept ||
    accept === "*/*" ||
    accept.includes("application/json") ||
    accept.includes("text/event-stream")
  ) {
    const normalized = "application/json, text/event-stream";
    request.headers.accept = normalized;
    const acceptIndex = request.rawHeaders.findIndex(
      (value, index) => index % 2 === 0 && value.toLowerCase() === "accept",
    );
    if (acceptIndex >= 0) {
      request.rawHeaders[acceptIndex + 1] = normalized;
    } else {
      request.rawHeaders.push("Accept", normalized);
    }
  }
}

export function createHttpHandler(
  dependencies: AppDependencies,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/healthz") {
      const context = dependencies.executionContext(null);
      const result = await executeTool("health", {}, context);
      json(response, 200, result.structuredContent ?? { status: "locked" });
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/.well-known/oauth-protected-resource"
    ) {
      const metadata = protectedResourceMetadata(dependencies.config);
      if (!metadata) {
        json(response, 503, {
          error: "protected_resource_metadata_not_configured",
        });
        return;
      }
      json(response, 200, metadata);
      return;
    }

    if (url.pathname !== "/mcp") {
      json(response, 404, { error: "not_found" });
      return;
    }
    if (request.method !== "POST") {
      methodNotAllowed(response);
      return;
    }

    const length = Number(request.headers["content-length"] ?? "0");
    if (Number.isFinite(length) && length > 1_048_576) {
      json(response, 413, { error: "request_too_large" });
      return;
    }

    const bearer = accessToken(request);
    if (bearer.kind === "malformed") {
      const metadataUrl = dependencies.config.protectedResourceMetadataUrl;
      const headers = metadataUrl
        ? {
            "WWW-Authenticate": createWwwAuthenticateChallenge({
              protectedResourceMetadataUrl: metadataUrl,
              error: "invalid_token",
              description: "Authorization must contain one Bearer token.",
            }),
          }
        : {};
      json(response, 401, { error: "invalid_authorization_header" }, headers);
      return;
    }

    const context = dependencies.executionContext(
      bearer.kind === "valid" ? bearer.token : null,
    );
    // ChatGPT can send a JSON-only or wildcard Accept header on the first
    // post-OAuth MCP request. The SDK requires both response media types even
    // though this server has JSON responses enabled. Normalize only clients
    // that already accept an MCP response type (or the HTTP wildcard); leave
    // unrelated media types to the SDK's 406 response.
    normalizeMcpPostAcceptHeader(request);
    const server = createProtocolServer(context);
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    try {
      // SDK 1.29's transport declarations predate exactOptionalPropertyTypes;
      // the runtime object implements the same MCP Transport interface.
      await server.connect(transport as Parameters<Server["connect"]>[0]);
      const parsedBody = (request as IncomingMessage & { body?: unknown }).body;
      await transport.handleRequest(request, response, parsedBody);
    } catch {
      if (!response.headersSent) {
        json(response, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    } finally {
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    }
  };
}
