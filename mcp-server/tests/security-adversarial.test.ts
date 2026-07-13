import assert from "node:assert/strict";
import test from "node:test";

import { generateKeyPair, SignJWT, type JWTPayload } from "jose";

import {
  createAuthenticationToolResult,
  createWwwAuthenticateChallenge,
} from "../src/auth/challenge.js";
import { JwtAccessTokenVerifier } from "../src/auth/tokenVerifier.js";
import {
  LockedTokenVerifier,
  TokenVerificationError,
  type AccessTokenVerifier,
  type ProtectedAction,
} from "../src/auth/types.js";
import { loadRuntimeConfig } from "../src/config/runtime.js";
import {
  RepositoryRequestError,
  type NutritionRepository,
  type RpcInvocation,
} from "../src/repositories/types.js";
import {
  executeTool,
  type ToolExecutionContext,
} from "../src/tools/execute.js";

const SYNTHETIC_ISSUER = "https://synthetic-auth.invalid/auth/v1";
const SYNTHETIC_RESOURCE = "https://synthetic-mcp.invalid/mcp";
const SYNTHETIC_METADATA =
  "https://synthetic-mcp.invalid/.well-known/oauth-protected-resource";
const SYNTHETIC_SUBJECT = "61000000-0000-4000-8000-000000000001";
const SYNTHETIC_CLIENT = "synthetic-approved-client";
const ACTION: ProtectedAction = "confirm_food_log";

async function fixture() {
  const approved = await generateKeyPair("RS256");
  const attacker = await generateKeyPair("RS256");
  const now = Math.floor(Date.now() / 1000);
  const baseClaims: JWTPayload = {
    iss: SYNTHETIC_ISSUER,
    aud: SYNTHETIC_RESOURCE,
    sub: SYNTHETIC_SUBJECT,
    exp: now + 300,
    iat: now,
    nbf: now - 5,
    role: "authenticated",
    client_id: SYNTHETIC_CLIENT,
    scope: "openid profile",
  };
  const sign = async (
    overrides: Partial<JWTPayload> = {},
    privateKey = approved.privateKey,
  ) =>
    new SignJWT({ ...baseClaims, ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "synthetic-local-key" })
      .sign(privateKey);
  const verifier = new JwtAccessTokenVerifier(
    {
      issuer: SYNTHETIC_ISSUER,
      audience: SYNTHETIC_RESOURCE,
      jwksUri: "https://synthetic-auth.invalid/.well-known/jwks.json",
      algorithms: ["RS256"],
      expectedRole: "authenticated",
      allowedClientActions: {
        [SYNTHETIC_CLIENT]: [ACTION],
        "synthetic-read-client": ["get_day_history"],
      },
      clockToleranceSeconds: 0,
    },
    approved.publicKey,
  );
  const verify = (accessToken: string | null, action = ACTION) =>
    verifier.verify({ accessToken, action, requiredScopes: ["openid"] });
  return { approved, attacker, now, sign, verifier, verify };
}

function hasCode(code: string) {
  return (error: unknown) =>
    error instanceof TokenVerificationError && error.code === code;
}

const PRINCIPAL = {
  subject: SYNTHETIC_SUBJECT,
  clientId: SYNTHETIC_CLIENT,
  scopes: ["openid"],
  issuer: SYNTHETIC_ISSUER,
  audience: [SYNTHETIC_RESOURCE],
  expiresAt: 4_102_444_800,
  tokenId: "synthetic-token-id",
  accessToken: "synthetic.secret.token-canary",
} as const;

function executionFixture(
  options: {
    verifier?: AccessTokenVerifier;
    repository?: NutritionRepository;
    blockers?: readonly string[];
  } = {},
) {
  let verifyCalls = 0;
  let repositoryCalls = 0;
  const invocations: RpcInvocation[] = [];
  const verifier =
    options.verifier ??
    ({
      configured: true,
      async verify() {
        verifyCalls += 1;
        return PRINCIPAL;
      },
    } satisfies AccessTokenVerifier);
  const repository =
    options.repository ??
    ({
      configured: true,
      async invoke(invocation) {
        repositoryCalls += 1;
        invocations.push(invocation);
        return [{ fixture_result: "synthetic" }];
      },
    } satisfies NutritionRepository);
  const context: ToolExecutionContext = {
    accessToken: PRINCIPAL.accessToken,
    protectedResourceMetadataUrl: SYNTHETIC_METADATA,
    verifier,
    repository,
    health: {
      authConfigured: verifier.configured,
      repositoryConfigured: repository.configured,
      productionReady: false,
      blockers:
        options.blockers ??
        (["supabase_custom_application_scopes_unavailable"] as const),
    },
  };
  return {
    context,
    invocations,
    verifyCalls: () => verifyCalls,
    repositoryCalls: () => repositoryCalls,
  };
}

test("accepts only the complete synthetic owner/client/action token", async () => {
  const { sign, verify } = await fixture();
  const token = await sign();
  const principal = await verify(token);

  assert.equal(principal.subject, SYNTHETIC_SUBJECT);
  assert.equal(principal.clientId, SYNTHETIC_CLIENT);
  assert.deepEqual(principal.audience, [SYNTHETIC_RESOURCE]);
  assert.deepEqual(principal.scopes, ["openid", "profile"]);
  assert.equal(principal.accessToken, token);
});

test("default-denies missing, malformed, and wrongly signed tokens", async () => {
  const { attacker, sign, verify } = await fixture();

  await assert.rejects(verify(null), hasCode("missing_token"));
  await assert.rejects(verify("not-a-jwt"), hasCode("invalid_token"));
  await assert.rejects(
    verify(await sign({}, attacker.privateKey)),
    hasCode("invalid_token"),
  );
});

test("requires exact issuer and exactly one canonical resource audience", async () => {
  const { sign, verify } = await fixture();

  await assert.rejects(
    verify(await sign({ iss: "https://other-tenant.invalid/auth/v1" })),
    hasCode("invalid_issuer"),
  );
  await assert.rejects(
    verify(await sign({ aud: "https://other-resource.invalid/mcp" })),
    hasCode("invalid_audience"),
  );
  await assert.rejects(
    verify(await sign({ aud: [SYNTHETIC_RESOURCE, "authenticated"] })),
    hasCode("invalid_audience"),
  );
  await assert.rejects(
    verify(await sign({ resource: "https://other-resource.invalid/mcp" })),
    hasCode("invalid_audience"),
  );
});

test("rejects expired, future-not-before, and future-issued tokens", async () => {
  const { now, sign, verify } = await fixture();

  await assert.rejects(
    verify(await sign({ exp: now - 1 })),
    hasCode("invalid_time"),
  );
  await assert.rejects(
    verify(await sign({ nbf: now + 60 })),
    hasCode("invalid_time"),
  );
  await assert.rejects(
    verify(await sign({ iat: now + 60 })),
    hasCode("invalid_time"),
  );
});

test("rejects malformed subjects, wrong roles, and missing client identity", async () => {
  const { sign, verify } = await fixture();

  await assert.rejects(
    verify(await sign({ sub: "not-a-supabase-user-id" })),
    hasCode("missing_subject"),
  );
  await assert.rejects(
    verify(await sign({ role: "service_role" })),
    hasCode("invalid_role"),
  );
  await assert.rejects(
    verify(await sign({ client_id: undefined })),
    hasCode("missing_client_id"),
  );
});

test("default-denies missing scope, unknown client, and the wrong exact action", async () => {
  const { sign, verifier, verify } = await fixture();

  await assert.rejects(
    verify(await sign({ scope: "profile email" })),
    hasCode("insufficient_scope"),
  );
  await assert.rejects(
    verify(await sign({ client_id: "synthetic-unknown-client" })),
    hasCode("client_action_denied"),
  );
  await assert.rejects(
    verifier.verify({
      accessToken: await sign({ client_id: "synthetic-read-client" }),
      action: ACTION,
      requiredScopes: ["openid"],
    }),
    hasCode("client_action_denied"),
  );
});

test("locked configuration and challenges fail safely without token leakage", async () => {
  const locked: AccessTokenVerifier = new LockedTokenVerifier();
  await assert.rejects(
    locked.verify({
      accessToken: "synthetic-secret-token-canary",
      action: ACTION,
      requiredScopes: ["openid"],
    }),
    hasCode("verifier_not_configured"),
  );

  const challenge = createWwwAuthenticateChallenge({
    protectedResourceMetadataUrl: SYNTHETIC_METADATA,
    error: "invalid_token",
    description: "Synthetic authentication is required.",
  });
  assert.match(challenge, /^Bearer\s/);
  assert.match(challenge, /resource_metadata=/);
  assert.match(challenge, /error="invalid_token"/);
  assert.match(challenge, /error_description=/);
  assert.doesNotMatch(challenge, /synthetic-secret-token-canary/);

  const result = createAuthenticationToolResult({
    protectedResourceMetadataUrl: SYNTHETIC_METADATA,
    error: "insufficient_scope",
    description: "Synthetic action authorization is required.",
  });
  assert.equal(result.isError, true);
  assert.ok(Array.isArray(result._meta?.["mcp/www_authenticate"]));
  assert.doesNotMatch(JSON.stringify(result), /Bearer [A-Za-z0-9_-]+\./);
});

test("runtime configuration is default-deny and keeps custom scopes as a production blocker", () => {
  const baseEnv: NodeJS.ProcessEnv = {
    MCP_PUBLIC_BASE_URL: SYNTHETIC_RESOURCE,
    MCP_AUTH_ISSUER: SYNTHETIC_ISSUER,
    MCP_JWKS_URI: `${SYNTHETIC_ISSUER}/.well-known/jwks.json`,
    MCP_EXPECTED_AUDIENCE: SYNTHETIC_RESOURCE,
    MCP_AUTH_ALGORITHMS: "RS256",
    SUPABASE_URL: "https://synthetic-project.invalid",
    SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-fixture",
  };

  const denied = loadRuntimeConfig(baseEnv);
  assert.equal(denied.protectedToolsConfigured, false);
  assert.deepEqual(denied.allowedClientActions, {});
  assert.ok(denied.blockers.includes("missing_client_action_policy"));

  const configured = loadRuntimeConfig({
    ...baseEnv,
    MCP_ALLOWED_CLIENT_ACTIONS: JSON.stringify({
      [SYNTHETIC_CLIENT]: [ACTION],
    }),
  });
  assert.equal(configured.protectedToolsConfigured, true);
  assert.equal(configured.productionReady, false);
  assert.deepEqual(configured.standardScopes, ["openid"]);
  assert.ok(
    configured.blockers.includes(
      "supabase_custom_application_scopes_unavailable",
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(configured.standardScopes),
    /(?:food|weight|calories):(?:read|write)/,
  );
});

test("health is anonymous, degraded while blocked, and discloses no token", async () => {
  const fixture = executionFixture();
  const result = await executeTool("health", {}, fixture.context);

  assert.deepEqual(result.structuredContent, {
    status: "degraded",
    authentication: "configured",
    repository: "configured",
    production_ready: false,
    blockers: ["supabase_custom_application_scopes_unavailable"],
  });
  assert.equal(fixture.verifyCalls(), 0);
  assert.equal(fixture.repositoryCalls(), 0);
  assert.doesNotMatch(
    JSON.stringify(result),
    /synthetic\.secret\.token-canary/,
  );
});

test("protected authentication denial stops before repository invocation", async () => {
  const fixture = executionFixture({
    verifier: {
      configured: true,
      async verify() {
        throw new TokenVerificationError(
          "missing_token",
          "Synthetic token is absent.",
        );
      },
    },
  });
  const result = await executeTool(
    "get_day_history",
    { local_date: "2026-07-13" },
    fixture.context,
  );

  assert.equal(result.isError, true);
  assert.ok(Array.isArray(result._meta?.["mcp/www_authenticate"]));
  assert.equal(fixture.repositoryCalls(), 0);
  assert.doesNotMatch(
    JSON.stringify(result),
    /synthetic\.secret\.token-canary/,
  );
});

test("invalid confirmation is rejected before verification or repository access", async () => {
  const fixture = executionFixture();
  const result = await executeTool(
    "confirm_food_log",
    {
      preview_id: "61000000-0000-4000-8000-000000000002",
      confirmed_revision: 1,
      confirmation: false,
      idempotency_key: "synthetic-confirmation-key",
    },
    fixture.context,
  );

  assert.equal(result.isError, true);
  assert.equal(fixture.verifyCalls(), 0);
  assert.equal(fixture.repositoryCalls(), 0);
  const firstContent = result.content[0];
  assert.ok(firstContent && firstContent.type === "text");
  assert.match(firstContent.text, /failed validation/i);
});

test("preview and revision fail honestly without calling incompatible backend RPCs", async () => {
  const fixture = executionFixture();
  const preview = await executeTool(
    "preview_food_log",
    {
      meal_type: "lunch",
      consumed_at: "2026-07-13T04:00:00.000Z",
      original_description: "Synthetic QA preview only",
      items: [
        {
          food_name: "Synthetic QA meal",
          quantity: 1,
          unit: "serving",
          calories: 300,
          uncertainty: ["Synthetic fixture; not live nutrition data"],
        },
      ],
    },
    fixture.context,
  );
  const revision = await executeTool(
    "revise_food_log_preview",
    {
      preview_id: "61000000-0000-4000-8000-000000000002",
      expected_revision: 1,
      serving_id: "61000000-0000-4000-8000-000000000003",
      serving_count: 2,
    },
    fixture.context,
  );

  for (const result of [preview, revision]) {
    assert.equal(result.isError, true);
    assert.deepEqual(result.structuredContent, {
      code: "backend_contract_unavailable",
      permanent_write: false,
    });
    assert.equal(result._meta?.["mcp/www_authenticate"], undefined);
  }
  assert.equal(fixture.verifyCalls(), 2);
  assert.equal(fixture.repositoryCalls(), 0);
});

test("exact confirmation forwards no user identity or client aggregate totals", async () => {
  const fixture = executionFixture();
  const result = await executeTool(
    "confirm_food_log",
    {
      preview_id: "61000000-0000-4000-8000-000000000002",
      confirmed_revision: 4,
      confirmation: true,
      idempotency_key: "synthetic-confirmation-key",
    },
    fixture.context,
  );

  assert.equal(result.isError, undefined);
  assert.equal(fixture.verifyCalls(), 1);
  assert.equal(fixture.repositoryCalls(), 1);
  assert.equal(fixture.invocations[0]?.action, ACTION);
  assert.deepEqual(fixture.invocations[0]?.params, {
    p_preview_id: "61000000-0000-4000-8000-000000000002",
    p_confirmed_revision: 4,
    p_confirmation: true,
    p_idempotency_key: "synthetic-confirmation-key",
  });
  assert.doesNotMatch(
    JSON.stringify(fixture.invocations[0]?.params),
    /user_id|total_calories|protein_g|carbohydrates_g|fat_g/i,
  );
});

test("cross-user or repository authorization denial is generic and challenge-safe", async () => {
  const fixture = executionFixture({
    repository: {
      configured: true,
      async invoke() {
        throw new RepositoryRequestError(403, "owner_row_not_found");
      },
    },
  });
  const result = await executeTool(
    "delete_food_entry",
    {
      entry_id: "62000000-0000-4000-8000-000000000099",
      confirmation: true,
    },
    fixture.context,
  );

  assert.equal(result.isError, true);
  assert.ok(Array.isArray(result._meta?.["mcp/www_authenticate"]));
  assert.doesNotMatch(JSON.stringify(result), /owner_row_not_found/);
  assert.doesNotMatch(JSON.stringify(result), /62000000-0000-4000-8000/);
});
