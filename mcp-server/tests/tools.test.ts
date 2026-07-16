import assert from "node:assert/strict";
import test from "node:test";

import { toolDescriptors } from "../src/app.js";
import type {
  AccessTokenVerifier,
  VerifyAccessTokenRequest,
} from "../src/auth/types.js";
import { TokenVerificationError } from "../src/auth/types.js";
import type { NutritionRepository } from "../src/repositories/types.js";
import {
  executeTool,
  type ToolExecutionContext,
} from "../src/tools/execute.js";

const principal = {
  subject: "0f8fad5b-d9cb-469f-a165-70867728950e",
  clientId: "chatgpt",
  scopes: ["openid"],
  issuer: "https://auth.example.test",
  audience: ["https://mcp.example.test"],
  expiresAt: 9999999999,
  tokenId: null,
  accessToken: "token",
};

function context(
  options: {
    verifier?: AccessTokenVerifier;
    repository?: NutritionRepository;
  } = {},
): ToolExecutionContext {
  return {
    accessToken: "token",
    protectedResourceMetadataUrl:
      "https://mcp.example.test/.well-known/oauth-protected-resource",
    verifier:
      options.verifier ??
      ({
        configured: true,
        verify: async (_request: VerifyAccessTokenRequest) => principal,
      } satisfies AccessTokenVerifier),
    repository:
      options.repository ??
      ({
        configured: true,
        invoke: async () => [],
      } satisfies NutritionRepository),
    health: {
      authConfigured: true,
      repositoryConfigured: true,
      productionReady: false,
      blockers: ["hosted_oauth_and_mcp_inspector_unverified"],
    },
    now: () => new Date("2026-07-16T03:00:00Z"),
  };
}

test("descriptors declare schemas, truthful annotations, and standard scopes", () => {
  const descriptors = toolDescriptors() as Array<Record<string, unknown>>;
  assert.equal(descriptors.length, 12);
  for (const descriptor of descriptors) {
    assert.equal((descriptor.inputSchema as { type: string }).type, "object");
    assert.equal((descriptor.outputSchema as { type: string }).type, "object");
    assert.deepEqual(
      descriptor.securitySchemes,
      (descriptor._meta as Record<string, unknown>).securitySchemes,
    );
  }
  const preview = descriptors.find((item) => item.name === "preview_food_log")!;
  assert.equal(
    (preview.annotations as { readOnlyHint: boolean }).readOnlyHint,
    false,
  );
  assert.deepEqual(preview.securitySchemes, [
    { type: "oauth2", scopes: ["openid"] },
  ]);
});

test("today calories uses the current Manila date and server-owned total", async () => {
  let captured: Record<string, unknown> | undefined;
  const result = await executeTool(
    "get_today_calories",
    {},
    context({
      repository: {
        configured: true,
        invoke: async (invocation) => {
          captured = invocation.params;
          return [
            {
              local_date: "2026-07-16",
              consumed_calories: "1450.5",
              calorie_target: "2000",
              entry_count: 3,
            },
          ];
        },
      },
    }),
  );
  assert.deepEqual(captured, {
    p_start_date: "2026-07-16",
    p_end_date: "2026-07-16",
  });
  assert.deepEqual(result.structuredContent, {
    local_date: "2026-07-16",
    consumed_calories: 1450.5,
    calorie_target: 2000,
    calories_remaining: 549.5,
    entry_count: 3,
    manila_time_zone: "Asia/Manila",
  });
});

test("weekly protein averages seven Manila calendar days when macros are complete", async () => {
  let captured: Record<string, unknown> | undefined;
  const result = await executeTool(
    "get_weekly_protein_average",
    {},
    context({
      repository: {
        configured: true,
        invoke: async (invocation) => {
          captured = invocation.params;
          return Array.from({ length: 7 }, (_, index) => ({
            local_date: `2026-07-${String(10 + index).padStart(2, "0")}`,
            consumed_protein_g: 70,
            macro_data_complete: true,
            entry_count: index === 0 ? 0 : 2,
          }));
        },
      },
    }),
  );
  assert.deepEqual(captured, {
    p_start_date: "2026-07-10",
    p_end_date: "2026-07-16",
  });
  assert.deepEqual(result.structuredContent, {
    start_date: "2026-07-10",
    end_date: "2026-07-16",
    calendar_day_count: 7,
    days_with_entries: 6,
    total_protein_g: 490,
    average_daily_protein_g: 70,
    macro_data_complete: true,
    incomplete_dates: [],
    manila_time_zone: "Asia/Manila",
  });
});

test("weekly protein refuses to invent an average when a macro day is incomplete", async () => {
  const result = await executeTool(
    "get_weekly_protein_average",
    {},
    context({
      repository: {
        configured: true,
        invoke: async () =>
          Array.from({ length: 7 }, (_, index) => ({
            local_date: `2026-07-${String(10 + index).padStart(2, "0")}`,
            consumed_protein_g: index === 3 ? null : 70,
            macro_data_complete: index !== 3,
            entry_count: 1,
          })),
      },
    }),
  );
  assert.equal(result.structuredContent?.average_daily_protein_g, null);
  assert.deepEqual(result.structuredContent?.incomplete_dates, ["2026-07-13"]);
});

test("unapproved OAuth client fails closed without prompting a futile reconnect", async () => {
  const result = await executeTool(
    "get_today_calories",
    {},
    context({
      verifier: {
        configured: true,
        verify: async () => {
          throw new TokenVerificationError("client_action_denied", "denied");
        },
      },
    }),
  );
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    code: "oauth_client_not_approved",
  });
  assert.equal(result._meta, undefined);
});

test("configured but externally blocked health is degraded", async () => {
  const result = await executeTool("health", {}, context());
  assert.deepEqual(result.structuredContent, {
    status: "degraded",
    authentication: "configured",
    repository: "configured",
    production_ready: false,
    blockers: ["hosted_oauth_and_mcp_inspector_unverified"],
  });
});

test("preview authenticates then blocks without a repository call", async () => {
  let verified = false;
  let invoked = false;
  const verifier: AccessTokenVerifier = {
    configured: true,
    verify: async () => {
      verified = true;
      return principal;
    },
  };
  const repository: NutritionRepository = {
    configured: true,
    invoke: async () => {
      invoked = true;
      return [];
    },
  };
  const result = await executeTool(
    "preview_food_log",
    {
      meal_type: "lunch",
      consumed_at: "2026-07-13T12:00:00+08:00",
      original_description: "one cup rice",
      items: [
        {
          food_name: "Rice",
          quantity: 1,
          unit: "cup",
          calories: 200,
          is_estimated: true,
          uncertainty: { portion: "user estimate" },
        },
      ],
    },
    context({ verifier, repository }),
  );
  assert.equal(verified, true);
  assert.equal(invoked, false);
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    code: "backend_contract_unavailable",
    permanent_write: false,
  });
});

test("record weight maps only server-reviewed parameters and fixed timezone", async () => {
  let captured: Record<string, unknown> | undefined;
  const repository: NutritionRepository = {
    configured: true,
    invoke: async (invocation) => {
      captured = invocation.params;
      return [{ measurement_id: "m1" }];
    },
  };
  const result = await executeTool(
    "record_weight",
    {
      measured_at: "2026-07-13T08:00:00+08:00",
      weight_kg: 72.5,
      idempotency_key: "weight-20260713",
    },
    context({ repository }),
  );
  assert.equal(result.isError, undefined);
  assert.deepEqual(captured, {
    p_measured_at: "2026-07-13T08:00:00+08:00",
    p_time_zone: "Asia/Manila",
    p_weight_kg: 72.5,
    p_idempotency_key: "weight-20260713",
  });
  assert.equal("user_id" in (captured ?? {}), false);
});

test("confirmation requires literal true before verifier or repository", async () => {
  let verified = false;
  const result = await executeTool(
    "confirm_food_log",
    {
      preview_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
      confirmed_revision: 2,
      confirmation: false,
      idempotency_key: "confirmation-2",
    },
    context({
      verifier: {
        configured: true,
        verify: async () => {
          verified = true;
          return principal;
        },
      },
    }),
  );
  assert.equal(result.isError, true);
  assert.equal(verified, false);
});
