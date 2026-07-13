import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const migrationPath = join(
  repositoryRoot,
  "supabase/migrations/20260712133713_phase_2_core_schema.sql",
);
const databaseTestPaths = [
  join(repositoryRoot, "supabase/tests/database/phase_2_schema.test.sql"),
  join(repositoryRoot, "supabase/tests/database/phase_2_confirmation.test.sql"),
];
const migration = readFileSync(migrationPath, "utf8");
const databaseTests = databaseTestPaths.map((path) => ({
  path,
  sql: readFileSync(path, "utf8"),
}));
const allDatabaseSql = [migration, ...databaseTests.map(({ sql }) => sql)].join(
  "\n",
);

const requiredPublicTables = [
  "chatgpt_log_previews",
  "daily_summaries",
  "food_aliases",
  "food_entries",
  "food_entry_items",
  "food_log_preview_items",
  "food_log_preview_revisions",
  "food_products",
  "mcp_idempotency_keys",
  "nutrition_targets",
  "oauth_action_audit",
  "profiles",
  "restaurant_chains",
  "restaurant_meal_components",
  "restaurant_menu_items",
  "scan_sessions",
  "weight_logs",
].sort();

const canonicalComponentRoles = [
  "condiment",
  "drink",
  "main_dish",
  "meal",
  "rice",
  "sauce",
  "side_dish",
  "standalone",
  "topping",
].sort();

function matches(pattern, input = migration) {
  return [...input.matchAll(pattern)];
}

function normalized(input) {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}

function tableDefinition(tableName) {
  const result = migration.match(
    new RegExp(
      `create table public\\.${tableName} \\(\\n([\\s\\S]*?)\\n\\);`,
      "i",
    ),
  );
  assert.ok(result, `missing public.${tableName} table definition`);
  return result[1];
}

function functionDefinition(schema, functionName) {
  const result = migration.match(
    new RegExp(
      `create or replace function ${schema}\\.${functionName}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
      "i",
    ),
  );
  assert.ok(result, `missing ${schema}.${functionName} function definition`);
  return result[0];
}

function quotedValues(input) {
  return matches(/'([^']+)'/g, input).map((match) => match[1]);
}

test("migration creates exactly the required exposed tables and enables RLS on each", () => {
  const createdTables = matches(/create table public\.([a-z_]+)/gi).map(
    (match) => match[1].toLowerCase(),
  );
  const rlsTables = matches(
    /alter table public\.([a-z_]+) enable row level security;/gi,
  ).map((match) => match[1].toLowerCase());

  assert.deepEqual([...createdTables].sort(), requiredPublicTables);
  assert.deepEqual([...rlsTables].sort(), requiredPublicTables);
  assert.match(
    migration,
    /create table private\.oauth_client_action_policies\s*\(/i,
  );
});

test("ownership policies cache auth.uid and never authorize through auth.role", () => {
  const policySql = matches(/create policy\b[\s\S]*?;/gi)
    .map((match) => match[0])
    .join("\n");
  const uidCalls = matches(/\bauth\.uid\s*\(\s*\)/gi, policySql);
  const cachedUidCalls = matches(
    /\(\s*select\s+auth\.uid\s*\(\s*\)\s*\)/gi,
    policySql,
  );

  assert.ok(uidCalls.length > 0, "expected owner-scoped policy predicates");
  assert.equal(
    cachedUidCalls.length,
    uidCalls.length,
    "every auth.uid() policy lookup must use the cached select form",
  );
  assert.doesNotMatch(allDatabaseSql, /\bauth\.role\s*\(/i);
});

test("public functions remain security invoker while privileged helpers stay private", () => {
  const publicFunctions = matches(
    /create or replace function public\.([a-z_]+)\s*\([\s\S]*?\n\$\$;/gi,
  );

  assert.deepEqual(publicFunctions.map((match) => match[1]).sort(), [
    "confirm_food_log",
    "rebuild_my_daily_summaries",
  ]);
  for (const publicFunction of publicFunctions) {
    assert.match(publicFunction[0], /\bsecurity invoker\b/i);
    assert.doesNotMatch(publicFunction[0], /\bsecurity definer\b/i);
  }

  for (const name of ["confirm_food_log", "rebuild_my_daily_summaries"]) {
    const helper = functionDefinition("private", name);
    assert.match(helper, /\bsecurity definer\b/i);
    assert.match(helper, /set search_path = ''/i);
  }
});

test("OAuth client/action authorization is server-owned and default-deny", () => {
  const policyTable = migration.match(
    /create table private\.oauth_client_action_policies\s*\([\s\S]*?\n\);/i,
  )?.[0];
  assert.ok(policyTable);
  assert.match(policyTable, /enabled boolean not null default false/i);
  assert.match(policyTable, /primary key \(client_id, action\)/i);
  assert.match(policyTable, /not enabled or approved_at is not null/i);
  assert.doesNotMatch(
    migration,
    /insert into private\.oauth_client_action_policies/i,
  );

  const confirmation = functionDefinition("private", "confirm_food_log");
  const compactConfirmation = normalized(confirmation);
  assert.match(compactConfirmation, /\(select auth\.jwt\(\)\) ->> 'client_id'/);
  assert.match(
    compactConfirmation,
    /policy\.client_id = v_oauth_client_id and policy\.action = 'confirm_food_log' and policy\.enabled/,
  );

  const schemaSuite = databaseTests[0].sql;
  const confirmationSuite = databaseTests[1].sql;
  assert.match(
    schemaSuite,
    /count\(\*\)::integer from private\.oauth_client_action_policies[\s\S]*?0,[\s\S]*?starts default-deny/i,
  );
  assert.match(
    confirmationSuite,
    /missing OAuth client_id is denied by default/i,
  );
  assert.match(
    confirmationSuite,
    /unknown OAuth client\/action is denied by default/i,
  );
});

test("confirmation binds explicit consent to the exact current presented revision", () => {
  const confirmation = normalized(
    functionDefinition("private", "confirm_food_log"),
  );
  const header = confirmation.slice(0, confirmation.indexOf("returns table"));

  assert.doesNotMatch(header, /p_user_id|p_total|p_calories|p_macros/);
  assert.match(confirmation, /p_confirmation is distinct from true/);
  assert.match(confirmation, /message = 'explicit confirmation is required'/);
  assert.match(confirmation, /v_preview\.status <> 'ready'/);
  assert.match(confirmation, /v_preview\.expires_at <= now\(\)/);
  assert.match(
    confirmation,
    /v_preview\.revision_number <> p_confirmed_revision/,
  );
  assert.match(confirmation, /v_preview\.last_presented_at is null/);
  assert.match(
    confirmation,
    /v_revision\.presented_at <> v_preview\.last_presented_at/,
  );
  assert.match(
    confirmation,
    /where p\.id = p_preview_id and p\.user_id = v_user_id for update/,
  );
  assert.match(
    confirmation,
    /where r\.preview_id = v_preview\.id and r\.revision_number = v_preview\.revision_number and r\.user_id = v_user_id/,
  );
});

test("confirmation implements owner-scoped request-bound idempotency", () => {
  const idempotencyTable = normalized(tableDefinition("mcp_idempotency_keys"));
  const confirmation = normalized(
    functionDefinition("private", "confirm_food_log"),
  );

  assert.match(
    idempotencyTable,
    /unique \(user_id, operation, idempotency_key\)/,
  );
  assert.match(
    confirmation,
    /on conflict \(user_id, operation, idempotency_key\) do nothing/,
  );
  assert.match(
    confirmation,
    /where k\.user_id = v_user_id and k\.operation = 'confirm_food_log' and k\.idempotency_key = p_idempotency_key for update/,
  );
  assert.match(
    confirmation,
    /v_idempotency\.preview_id is distinct from p_preview_id or v_idempotency\.confirmed_revision is distinct from p_confirmed_revision or v_idempotency\.confirmation is distinct from true/,
  );
  assert.match(confirmation, /if v_idempotency\.status = 'completed' then/);
  assert.match(confirmation, /idempotency_outcome[\s\S]*?'reused'/);
  assert.match(confirmation, /set status = 'completed'/);
  assert.match(confirmation, /idempotency_outcome[\s\S]*?'created'/);

  const entries = normalized(tableDefinition("food_entries"));
  assert.match(entries, /unique \(source_preview_id\)/);
});

test("preview and permanent items share canonical roles and owner-safe parent linkage", () => {
  for (const tableName of ["food_log_preview_items", "food_entry_items"]) {
    const definition = tableDefinition(tableName);
    const roleCheck = definition.match(
      /component_role in \(([\s\S]*?)\)\s*\)/i,
    )?.[1];
    assert.ok(roleCheck, `missing ${tableName} component role check`);
    assert.deepEqual(quotedValues(roleCheck).sort(), canonicalComponentRoles);
    assert.match(
      normalized(definition),
      /parent_[a-z_]+ is null and component_role in \('standalone', 'meal'\)/,
    );
    assert.match(
      normalized(definition),
      /parent_[a-z_]+ is not null and component_role not in \('standalone', 'meal'\)/,
    );
  }

  assert.match(
    normalized(tableDefinition("food_log_preview_items")),
    /foreign key \(parent_preview_item_id, preview_id, revision_number, user_id\) references public\.food_log_preview_items \(id, preview_id, revision_number, user_id\)/,
  );
  assert.match(
    normalized(tableDefinition("food_entry_items")),
    /foreign key \(parent_entry_item_id, food_entry_id, user_id\) references public\.food_entry_items \(id, food_entry_id, user_id\)/,
  );

  const confirmation = normalized(
    functionDefinition("private", "confirm_food_log"),
  );
  assert.match(
    confirmation,
    /source_preview_item_id, parent_source_preview_item_id, parent_entry_item_id,[\s\S]*?i\.id, i\.parent_preview_item_id, i\.parent_preview_item_id, i\.component_role/,
  );
});

test("table and function ACLs default to least privilege", () => {
  const compactMigration = normalized(migration);

  assert.match(
    compactMigration,
    /revoke all on table[\s\S]*?from anon, authenticated;/,
  );
  assert.match(
    compactMigration,
    /grant select on table[\s\S]*?to authenticated;/,
  );
  assert.doesNotMatch(
    compactMigration,
    /grant (?:insert|update|delete|all)[\s\S]*?on table[\s\S]*?to (?:anon|authenticated)/,
  );
  assert.match(
    compactMigration,
    /revoke execute on all functions in schema public from public, anon, authenticated/,
  );
  assert.match(
    compactMigration,
    /revoke execute on all functions in schema private from public, anon, authenticated/,
  );
  assert.match(
    compactMigration,
    /alter default privileges for role postgres revoke execute on functions from public;/,
  );
  assert.doesNotMatch(
    compactMigration,
    /alter default privileges(?: for role postgres)? in schema [a-z_]+ revoke execute on functions from public/,
    "schema-scoped default privilege revokes cannot replace the role-global PUBLIC execute revoke",
  );

  const grants = matches(
    /grant execute on function ([a-z_]+\.[a-z_]+\([^;]+?\)) to authenticated;/gi,
  ).map((match) => normalized(match[1]));
  assert.deepEqual(grants.sort(), [
    "private.confirm_food_log(uuid, integer, boolean, text)",
    "private.rebuild_my_daily_summaries(date, date)",
    "public.confirm_food_log(uuid, integer, boolean, text)",
    "public.rebuild_my_daily_summaries(date, date)",
  ]);
});

test("runtime SQL suites contain the critical security assertions", () => {
  const schemaSuite = normalized(databaseTests[0].sql);
  const confirmationSuite = normalized(databaseTests[1].sql);

  assert.match(schemaSuite, /no public function is security definer/);
  assert.match(
    schemaSuite,
    /future private functions do not inherit role-global public execute/,
  );
  assert.match(
    schemaSuite,
    /postgres role-global function defaults revoke public execute/,
  );
  assert.match(
    schemaSuite,
    /authenticated cannot insert permanent entries directly/,
  );
  assert.match(confirmationSuite, /cross-user preview confirmation is denied/);
  assert.match(confirmationSuite, /stale revisions are rejected/);
  assert.match(
    confirmationSuite,
    /ambiguous or false confirmation cannot write/,
  );
  assert.match(
    confirmationSuite,
    /same idempotency key and request returns the original entry/,
  );
  assert.match(
    confirmationSuite,
    /same key with a different request conflicts/,
  );
  assert.match(
    confirmationSuite,
    /canonical component roles and parent linkage survive confirmation/,
  );
});

test("application artifacts contain no prohibited model API integration strings", () => {
  const ignoredDirectories = new Set([
    ".expo",
    ".git",
    "coverage",
    "dist",
    "docs",
    "node_modules",
    "tmp",
  ]);
  const ignoredFiles = new Set(["scripts/check-prohibited-openai-api.mjs"]);
  const sourceExtensions = new Set([
    ".cjs",
    ".js",
    ".json",
    ".jsx",
    ".mjs",
    ".sql",
    ".ts",
    ".tsx",
    ".toml",
    ".yaml",
    ".yml",
  ]);
  const provider = ["open", "ai"].join("");
  const patterns = [
    new RegExp(["api", provider, "com"].join("\\."), "i"),
    new RegExp([provider.toUpperCase(), "API", "KEY"].join("_")),
    new RegExp(["responses", "create"].join("\\s*\\.\\s*"), "i"),
    new RegExp(["chat", "completions"].join("\\s*\\.\\s*"), "i"),
    new RegExp([provider, "responses"].join("\\s*\\.\\s*"), "i"),
    new RegExp(["beta", "assistants"].join("\\s*\\.\\s*"), "i"),
    new RegExp(["images", "generate"].join("\\s*\\.\\s*"), "i"),
  ];
  const findings = [];

  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      const projectPath = relative(repositoryRoot, absolute).replaceAll(
        "\\",
        "/",
      );
      if (entry.isDirectory()) scan(absolute);
      if (
        entry.isFile() &&
        sourceExtensions.has(extname(entry.name)) &&
        !ignoredFiles.has(projectPath)
      ) {
        const contents = readFileSync(absolute, "utf8");
        for (const pattern of patterns) {
          if (pattern.test(contents))
            findings.push(`${projectPath}: ${pattern}`);
        }
      }
    }
  }

  scan(repositoryRoot);
  assert.deepEqual(findings, []);
});

test("each pgTAP plan equals its static assertion count", () => {
  const assertionPattern =
    /^\s*select\s+(?:has_table|has_column|col_type_is|ok|is|throws_ok|results_eq|lives_ok)\s*\(/gim;

  for (const { path, sql } of databaseTests) {
    const planMatch = sql.match(/select\s+plan\((\d+)\);/i);
    assert.ok(planMatch, `${relative(repositoryRoot, path)} has no pgTAP plan`);
    const planned = Number(planMatch[1]);
    const assertions = matches(assertionPattern, sql).length;

    assert.equal(
      assertions,
      planned,
      `${relative(repositoryRoot, path)} plans ${planned} but defines ${assertions} assertions`,
    );
    assert.match(sql, /select \* from finish\(\);/i);
    assert.match(sql, /rollback;\s*$/i);
  }
});
