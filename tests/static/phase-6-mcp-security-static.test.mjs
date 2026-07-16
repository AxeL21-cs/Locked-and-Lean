import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function source(path) {
  return readFileSync(join(root, path), "utf8");
}

function normalized(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

test("MCP package pins the protocol, Apps SDK, JWT, and schema dependencies", () => {
  const packageJson = JSON.parse(source("mcp-server/package.json"));
  assert.equal(packageJson.dependencies["@modelcontextprotocol/sdk"], "1.29.0");
  assert.equal(
    packageJson.dependencies["@modelcontextprotocol/ext-apps"],
    "1.7.4",
  );
  assert.equal(packageJson.dependencies.jose, "6.2.3");
  assert.equal(packageJson.dependencies.zod, "4.4.3");
  assert.ok(packageJson.scripts.check.includes("npm run build"));
  for (const dependency of Object.keys(packageJson.dependencies)) {
    assert.doesNotMatch(dependency, /^openai$|@openai\//i);
  }
});

test("runtime configuration is locked by default and keeps custom scopes blocked", () => {
  const runtime = source("mcp-server/src/config/runtime.ts");
  assert.match(runtime, /standardScopes:\s*\["openid"\]/);
  assert.match(runtime, /allowedClientActions[\s\S]*?\{\}/);
  assert.match(runtime, /missing_client_action_policy/);
  assert.match(runtime, /audience_must_equal_canonical_resource/);
  assert.match(runtime, /missing_asymmetric_jwt_algorithm/);
  assert.match(runtime, /supabase_custom_application_scopes_unavailable/);
  assert.match(runtime, /hosted_oauth_and_mcp_inspector_unverified/);
  assert.match(runtime, /productionReady:\s*false/);
  assert.doesNotMatch(
    runtime,
    /["'`](?:food|weight|calories):(?:read|write)["'`]/,
  );
  assert.doesNotMatch(runtime, /SERVICE_ROLE|SUPABASE_SECRET_KEY/);
});

test("JWT verifier pins asymmetric signature and exact identity/resource claims", () => {
  const verifier = normalized(source("mcp-server/src/auth/tokenVerifier.ts"));
  assert.match(verifier, /createremotejwkset/);
  assert.match(verifier, /algorithms: \[\.\.\.this\.config\.algorithms\]/);
  assert.match(verifier, /issuer: this\.config\.issuer/);
  assert.match(verifier, /audience: this\.config\.audience/);
  assert.match(
    verifier,
    /requiredclaims: \["iss", "aud", "sub", "exp", "iat"\]/,
  );
  assert.match(verifier, /payload\.nbf > now \+ this\.tolerance/);
  assert.match(verifier, /payload\.iat > now \+ this\.tolerance/);
  assert.match(verifier, /payload\.role !== this\.config\.expectedrole/);
  assert.match(verifier, /access token subject must be a uuid/);
  assert.match(verifier, /tokenaudiences\.length !== 1/);
  assert.match(verifier, /tokenaudiences\[0\] !== this\.config\.audience/);
  assert.match(verifier, /access token client_id is required/);
  assert.match(
    verifier,
    /allowedclientactions\[clientid\]\?\.includes\(request\.action\)/,
  );
  assert.match(verifier, /request\.requiredscopes\.some/);
  assert.match(verifier, /access token resource is invalid/);
});

test("protected-resource discovery and both OAuth challenge paths are present", () => {
  const metadata = source("mcp-server/src/http/protectedResource.ts");
  assert.match(metadata, /resource:\s*config\.publicBaseUrl/);
  assert.match(metadata, /authorization_servers:\s*\[config\.authIssuer\]/);
  assert.match(
    metadata,
    /scopes_supported:\s*\[\.\.\.config\.standardScopes\]/,
  );
  assert.match(metadata, /bearer_methods_supported:\s*\["header"\]/);
  assert.match(metadata, /resource_name:\s*"Locked and Lean"/);
  assert.match(
    metadata,
    /resource_documentation:\s*`\$\{config\.publicBaseUrl\}\/`/,
  );

  const app = source("mcp-server/src/app.ts");
  assert.match(app, /\/\.well-known\/oauth-protected-resource/);
  assert.match(app, /"WWW-Authenticate"/);
  assert.match(app, /json\(response, 401/);
  assert.match(app, /Authorization must contain one Bearer token/);

  const challenge = source("mcp-server/src/auth/challenge.ts");
  assert.match(challenge, /resource_metadata=/);
  assert.match(challenge, /error_description=/);
  assert.match(challenge, /"mcp\/www_authenticate"/);
  assert.match(challenge, /isError:\s*true/);
});

test("every tool mirrors its scheme and exposes truthful risk annotations", () => {
  const app = source("mcp-server/src/app.ts");
  assert.match(app, /securitySchemes:\s*definition\.securitySchemes/);
  assert.match(
    app,
    /_meta:[\s\S]*?securitySchemes:\s*definition\.securitySchemes/,
  );

  const catalog = source("mcp-server/src/tools/catalog.ts");
  assert.match(
    catalog,
    /const protectedSchemes = \[\{ type: "oauth2", scopes: \["openid"\] \}\]/,
  );
  assert.match(
    catalog,
    /name: "health"[\s\S]*?securitySchemes: \[\{ type: "noauth" \}\]/,
  );
  for (const tool of [
    "get_calendar_history",
    "get_day_history",
    "get_progress_summary",
    "get_weight_trend",
    "preview_food_log",
    "revise_food_log_preview",
    "confirm_food_log",
    "record_weight",
    "delete_food_entry",
  ]) {
    assert.match(catalog, new RegExp(`name: "${tool}"`));
  }
  for (const tool of ["preview_food_log", "revise_food_log_preview"]) {
    assert.match(
      catalog,
      new RegExp(
        `name: "${tool}"[\\s\\S]*?annotations: \\{[\\s\\S]*?readOnlyHint: false`,
      ),
    );
  }
  assert.match(catalog, /name: "confirm_food_log"[\s\S]*?idempotentHint: true/);
  assert.match(
    catalog,
    /name: "delete_food_entry"[\s\S]*?destructiveHint: true/,
  );
  assert.doesNotMatch(
    catalog,
    /["'`](?:food|weight|calories):(?:read|write)["'`]/,
  );
});

test("repository forwards the user token only to reviewed RPC mappings", () => {
  const repository = source(
    "mcp-server/src/repositories/supabaseRpcRepository.ts",
  );
  for (const action of [
    "get_calendar_history",
    "get_day_history",
    "get_progress_summary",
    "get_weight_trend",
    "confirm_food_log",
    "record_weight",
    "delete_food_entry",
  ]) {
    assert.match(repository, new RegExp(`${action}: "${action}"`));
  }
  assert.match(
    repository,
    /preview_food_log:\s*"create_chatgpt_food_log_preview"/,
  );
  assert.match(
    repository,
    /revise_food_log_preview:\s*"revise_chatgpt_food_log_preview"/,
  );
  assert.match(
    repository,
    /Authorization:\s*`Bearer \$\{invocation\.principal\.accessToken\}`/,
  );
  assert.match(repository, /apikey:\s*this\.options\.publishableKey/);
  assert.doesNotMatch(repository, /service.?role|secret.?key/i);
});

test("tool execution preserves preview-only and exact confirmation boundaries", () => {
  const execute = source("mcp-server/src/tools/execute.ts");
  assert.match(execute, /definition\.inputSchema\.safeParse/);
  assert.match(execute, /permanent_write:\s*false/);
  assert.match(execute, /p_items:\s*input\.items/);
  assert.match(execute, /p_time_zone:\s*"Asia\/Manila"/);
  assert.match(execute, /p_confirmed_revision:\s*input\.confirmed_revision/);
  assert.match(execute, /p_confirmation:\s*input\.confirmation/);
  assert.match(execute, /p_idempotency_key:\s*input\.idempotency_key/);
  assert.doesNotMatch(execute, /p_user_id|user_id:\s*input\./);
  assert.doesNotMatch(
    execute,
    /p_total_calories|p_total_protein|p_total_carbohydrates|p_total_fat/,
  );
  assert.match(
    execute,
    /context\.verifier\.verify[\s\S]*?context\.repository\.invoke/,
  );
});

test("ChatGPT preview RPCs are owner-derived, client-scoped, and preview-only", () => {
  const migration = source(
    "supabase/migrations/20260716110100_chatgpt_food_preview_flow.sql",
  );
  assert.match(migration, /v_user_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(
    migration,
    /v_client_id text := \(select auth\.jwt\(\)\) ->> 'client_id'/,
  );
  assert.match(
    migration,
    /policy\.action = 'preview_food_log'[\s\S]*?policy\.enabled/,
  );
  assert.match(
    migration,
    /policy\.action = 'revise_food_log_preview'[\s\S]*?policy\.enabled/,
  );
  assert.match(migration, /'chatgpt', 'draft'/);
  assert.match(migration, /'chatgpt_interpretation_v1'/);
  assert.match(migration, /coalesce\(sum\(i\.calories\), 0\)/);
  assert.match(migration, /item\.is_estimated/);
  assert.doesNotMatch(
    migration,
    /p_user_id|p_total_calories|p_total_protein|p_total_carbohydrates|p_total_fat/,
  );
  assert.match(
    migration,
    /create or replace function public\.create_chatgpt_food_log_preview[\s\S]*?security invoker/,
  );
  assert.match(
    migration,
    /revoke all on function private\.create_chatgpt_food_log_preview[\s\S]*?from public, anon, authenticated/,
  );
  assert.doesNotMatch(migration, /insert into public\.food_entries/);
});

test("OAuth consent is hosted-only, fresh-user-bound, and blocks unsupported scopes", () => {
  const environment = source("src/config/environment.ts");
  assert.match(environment, /oauthConsentMode !== "hosted"/);
  assert.match(environment, /url\.protocol !== "https:" \|\| local/);
  assert.match(environment, /OAuth consent is disabled in this build/);

  const authorization = source("src/features/oauth/authorization.ts");
  assert.match(
    authorization,
    /STANDARD_OAUTH_SCOPES = \[[\s\S]*?"openid"[\s\S]*?"email"[\s\S]*?"profile"[\s\S]*?"phone"/,
  );
  assert.match(authorization, /value\.length !== 1/);
  assert.match(authorization, /returned\.origin === expected\.origin/);
  assert.match(authorization, /returned\.pathname === expected\.pathname/);
  assert.match(authorization, /returned\.hash/);

  const adapter = source("src/services/supabase/adapter.ts");
  assert.match(adapter, /auth\.getUser\(\)/);
  assert.match(adapter, /getAuthorizationDetails/);
  assert.match(adapter, /data\.authorization_id !== normalizedId/);
  assert.match(adapter, /data\.user\.id !== user\.id/);
  assert.match(adapter, /Unsupported OAuth scopes requested/);
  assert.match(adapter, /details\.approvalBlockedReasons\.length/);
  assert.match(adapter, /approveAuthorization/);
  assert.match(adapter, /denyAuthorization/);
  assert.match(
    adapter,
    /isSafeServerRedirect\(data\.redirect_url, details\.redirectUri\)/,
  );

  const consent = source("src/features/oauth/OAuthConsentFlow.tsx");
  assert.match(consent, /These are identity scopes only/);
  assert.match(consent, /Approval blocked/);
  assert.match(
    consent,
    /disabled=[\s\S]*?details\.approvalBlockedReasons\.length > 0/,
  );
  assert.match(consent, /No fallback authorization/);
  assert.doesNotMatch(consent, /Approve food|Approve weight|calories:write/);
});

test("MCP health and source surface contain no model API integration or secret logging", () => {
  const roots = ["mcp-server/src", "mcp-server/tests"];
  const extensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
  const patterns = [
    /api\.openai\.com/i,
    new RegExp(["OPENAI", "API", "KEY"].join("_")),
    /responses\s*\.\s*create/i,
    /chat\s*\.\s*completions/i,
    /beta\s*\.\s*assistants/i,
    /console\.(?:log|error|warn)\s*\([^)]*(?:authorization|accessToken|refreshToken)/i,
  ];
  const findings = [];

  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      if (entry.isFile() && extensions.has(extname(entry.name))) {
        const contents = readFileSync(path, "utf8");
        for (const pattern of patterns) {
          if (pattern.test(contents)) {
            findings.push(`${relative(root, path)}: ${pattern}`);
          }
        }
      }
    }
  }

  for (const directory of roots) scan(join(root, directory));
  assert.deepEqual(findings, []);

  const securityTesting = source("docs/MCP_SECURITY_TESTING.md");
  assert.match(
    securityTesting,
    /general production ChatGPT food or weight writes remain blocked/i,
  );
  assert.match(securityTesting, /synthetic asymmetric-token verification/i);
  assert.match(securityTesting, /hosted Supabase OAuth/i);
});
