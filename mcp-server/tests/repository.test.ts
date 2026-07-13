import assert from "node:assert/strict";
import test from "node:test";

import { SupabaseRpcRepository } from "../src/repositories/supabaseRpcRepository.js";
import { RepositoryRequestError } from "../src/repositories/types.js";

const principal = {
  subject: "0f8fad5b-d9cb-469f-a165-70867728950e",
  clientId: "chatgpt",
  scopes: ["openid"],
  issuer: "https://auth.example.test",
  audience: ["https://mcp.example.test"],
  expiresAt: 9999999999,
  tokenId: null,
  accessToken: "user-access-token",
};

test("calls only the reviewed RPC with the user token and publishable key", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const repository = new SupabaseRpcRepository({
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "publishable-key",
    fetch: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify([{ entry_id: "e1" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await repository.invoke({
    action: "confirm_food_log",
    principal,
    params: { p_preview_id: "p1" },
  });
  assert.equal(
    requestUrl,
    "https://project.supabase.co/rest/v1/rpc/confirm_food_log",
  );
  assert.equal(
    (requestInit?.headers as Record<string, string>).Authorization,
    "Bearer user-access-token",
  );
  assert.equal(
    (requestInit?.headers as Record<string, string>).apikey,
    "publishable-key",
  );
  assert.doesNotMatch(JSON.stringify(requestInit), /service[_-]?role/i);
});

test("unsupported preview action cannot reach fetch", async () => {
  let called = false;
  const repository = new SupabaseRpcRepository({
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "publishable-key",
    fetch: async () => {
      called = true;
      return new Response("[]");
    },
  });
  await assert.rejects(
    repository.invoke({
      action: "preview_food_log",
      principal,
      params: {},
    }),
    (error) =>
      error instanceof RepositoryRequestError &&
      error.code === "backend_contract_unavailable",
  );
  assert.equal(called, false);
});

test("repository errors expose only bounded status and code", async () => {
  const repository = new SupabaseRpcRepository({
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "publishable-key",
    fetch: async () =>
      new Response(JSON.stringify({ code: "42501", secret: "do-not-leak" }), {
        status: 403,
      }),
  });
  await assert.rejects(
    repository.invoke({
      action: "get_day_history",
      principal,
      params: { p_local_date: "2026-07-13" },
    }),
    (error) =>
      error instanceof RepositoryRequestError &&
      error.status === 403 &&
      error.code === "42501" &&
      !error.message.includes("do-not-leak"),
  );
});
