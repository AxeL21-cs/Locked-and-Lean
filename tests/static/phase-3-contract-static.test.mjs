import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const migrationPath = join(
  root,
  "supabase/migrations/20260712230402_phase_3_core_backend.sql",
);
const qaSqlPath = join(root, "supabase/tests/database/phase_3_qa.test.sql");
const adapterPath = join(root, "src/services/supabase/adapter.ts");
const migration = readFileSync(migrationPath, "utf8");
const adapter = readFileSync(adapterPath, "utf8");

function normalized(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function functionDefinition(schema, name) {
  const result = migration.match(
    new RegExp(
      `create or replace function ${schema}\\.${name}\\s*\\([\\s\\S]*?\\$\\$;`,
      "i",
    ),
  );
  assert.ok(result, `missing ${schema}.${name}`);
  return result[0];
}

function parameterNames(schema, name) {
  const definition = functionDefinition(schema, name);
  const header = definition.slice(
    0,
    definition.toLowerCase().indexOf("returns"),
  );
  return [
    ...header.matchAll(/\b(p_[a-z0-9_]+)\s+[a-z][a-z0-9_]*(?:\[\])?/gi),
  ].map((match) => match[1].toLowerCase());
}

function adapterMethod(name) {
  const result = adapter.match(
    new RegExp(
      `\\n  async ${name}\\([\\s\\S]*?(?=\\n  async [a-z]|\\n};)`,
      "i",
    ),
  );
  assert.ok(result, `missing mobile adapter method ${name}`);
  return result[0];
}

const rpcContracts = {
  upsert_profile: [
    "p_display_name",
    "p_birth_date",
    "p_formula_sex",
    "p_height_cm",
    "p_preferred_units",
    "p_time_zone",
  ],
  propose_nutrition_target: [
    "p_weight_kg",
    "p_activity_level",
    "p_goal",
    "p_requested_weekly_weight_change_kg",
    "p_effective_from",
  ],
  confirm_nutrition_target: ["p_target_id", "p_confirmation"],
  create_manual_food_log_preview: [
    "p_meal_type",
    "p_consumed_at",
    "p_time_zone",
    "p_original_description",
    "p_items",
  ],
  save_food_for_reuse: [
    "p_canonical_name",
    "p_brand_name",
    "p_barcode",
    "p_serving_quantity",
    "p_serving_unit",
    "p_serving_weight_g",
    "p_calories",
    "p_confirmation",
    "p_protein_g",
    "p_carbohydrates_g",
    "p_fat_g",
  ],
  record_weight: [
    "p_measured_at",
    "p_time_zone",
    "p_weight_kg",
    "p_idempotency_key",
  ],
  delete_food_entry: ["p_entry_id", "p_confirmation"],
  confirm_food_log: [
    "p_preview_id",
    "p_confirmed_revision",
    "p_confirmation",
    "p_idempotency_key",
  ],
};

test("Phase 3 public RPCs keep exact bounded signatures", () => {
  for (const [name, expected] of Object.entries(rpcContracts)) {
    assert.deepEqual(parameterNames("public", name), expected, name);
    const wrapper = normalized(functionDefinition("public", name));
    assert.match(wrapper, /security invoker/);
    assert.doesNotMatch(wrapper, /security definer/);
  }
});

test("write RPCs derive identity and never accept user IDs or aggregate totals", () => {
  for (const [name, parameters] of Object.entries(rpcContracts)) {
    assert.ok(!parameters.includes("p_user_id"), `${name} accepts p_user_id`);
    assert.ok(
      !parameters.some((parameter) => /^p_total_/.test(parameter)),
      `${name} accepts a client aggregate`,
    );
  }

  for (const name of [
    "upsert_profile",
    "propose_nutrition_target",
    "confirm_nutrition_target",
    "create_manual_food_log_preview",
    "save_food_for_reuse",
    "record_weight",
    "delete_food_entry",
    "confirm_food_log",
  ]) {
    const helper = normalized(functionDefinition("private", name));
    assert.match(helper, /v_user_id uuid := \(select auth\.uid\(\)\)/, name);
    assert.match(helper, /security definer/, name);
    assert.match(helper, /set search_path = ''/, name);
  }
});

test("mobile adapter calls exact RPC argument contracts without identity or totals", () => {
  const methods = {
    upsertProfile: "upsert_profile",
    proposeNutritionTarget: "propose_nutrition_target",
    confirmNutritionTarget: "confirm_nutrition_target",
    createManualFoodPreview: "create_manual_food_log_preview",
    saveFoodForReuse: "save_food_for_reuse",
    recordWeight: "record_weight",
    deleteFoodEntry: "delete_food_entry",
    confirmFoodPreview: "confirm_food_log",
  };

  for (const [methodName, rpcName] of Object.entries(methods)) {
    const method = adapterMethod(methodName);
    assert.match(method, new RegExp(`rpc\\("${rpcName}"`));
    const sent = [...method.matchAll(/\b(p_[a-z0-9_]+)\s*:/gi)].map((match) =>
      match[1].toLowerCase(),
    );
    assert.deepEqual([...new Set(sent)], rpcContracts[rpcName], methodName);
    assert.doesNotMatch(method, /\bp_user_id\b|\bp_total_[a-z0-9_]+\b/i);
  }
});

test("manual logging remains preview-first and permanent tables are read-only to the adapter", () => {
  const preview = adapterMethod("createManualFoodPreview");
  const confirmation = adapterMethod("confirmFoodPreview");

  assert.match(preview, /rpc\("create_manual_food_log_preview"/);
  assert.doesNotMatch(preview, /confirm_food_log|p_confirmation/);
  assert.match(confirmation, /rpc\("confirm_food_log"/);
  assert.match(confirmation, /p_confirmed_revision:\s*revision/);
  assert.match(confirmation, /p_confirmation:\s*true/);
  assert.doesNotMatch(
    adapter,
    /\.from\(["'](?:food_entries|food_entry_items|daily_summaries)["']\)\s*\.\s*(?:insert|upsert|update|delete)\s*\(/i,
  );
});

test("first-party manual confirmation does not weaken the ChatGPT OAuth path", () => {
  const confirmation = normalized(
    functionDefinition("private", "confirm_food_log"),
  );

  assert.match(
    confirmation,
    /v_client_id is null and v_preview\.source_kind not in \('manual', 'barcode', 'saved_food'\)/,
  );
  assert.match(
    confirmation,
    /v_client_id is not null and not exists \( select 1 from private\.oauth_client_action_policies as policy where policy\.client_id = v_client_id and policy\.action = 'confirm_food_log' and policy\.enabled \)/,
  );
  assert.doesNotMatch(
    confirmation,
    /source_kind\s*=\s*'chatgpt'[\s\S]*?(?:bypass|allow|true)/,
  );
});

test("Phase 3 runtime QA plan matches its assertion count", () => {
  const sql = readFileSync(qaSqlPath, "utf8");
  const plan = Number(sql.match(/select\s+plan\((\d+)\);/i)?.[1]);
  const assertions = [
    ...sql.matchAll(
      /^\s*select\s+(?:ok|is|isnt|throws_ok|results_eq|lives_ok)\s*\(/gim,
    ),
  ].length;
  assert.equal(assertions, plan);
  assert.match(sql, /^begin;/i);
  assert.match(sql, /select \* from finish\(\);\s*rollback;\s*$/i);
});

test("Phase 3 application artifacts contain no model API integration", () => {
  const roots = ["app", "src", "mcp-server/src", "supabase/migrations"];
  const extensions = new Set([".js", ".jsx", ".mjs", ".sql", ".ts", ".tsx"]);
  const provider = ["open", "ai"].join("");
  const patterns = [
    new RegExp(["api", provider, "com"].join("\\."), "i"),
    new RegExp([provider.toUpperCase(), "API", "KEY"].join("_")),
    new RegExp(["responses", "create"].join("\\s*\\.\\s*"), "i"),
    new RegExp(["chat", "completions"].join("\\s*\\.\\s*"), "i"),
    new RegExp(["beta", "assistants"].join("\\s*\\.\\s*"), "i"),
  ];
  const findings = [];

  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      if (entry.isFile() && extensions.has(extname(entry.name))) {
        const source = readFileSync(path, "utf8");
        for (const pattern of patterns) {
          if (pattern.test(source))
            findings.push(`${relative(root, path)}: ${pattern}`);
        }
      }
    }
  }

  for (const directory of roots) scan(join(root, directory));
  assert.deepEqual(findings, []);
});
