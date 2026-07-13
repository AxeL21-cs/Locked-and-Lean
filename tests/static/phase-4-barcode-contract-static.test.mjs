import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const migrationPath = join(
  root,
  "supabase/migrations/20260712234027_phase_4_barcode_backend.sql",
);
const databaseTestPath = join(
  root,
  "supabase/tests/database/phase_4_barcode_backend.test.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const databaseTest = readFileSync(databaseTestPath, "utf8");

function source(path) {
  return readFileSync(join(root, path), "utf8");
}

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

test("barcode domain exports the required deterministic contracts", () => {
  const index = source("src/domain/barcode/index.ts");
  for (const moduleName of [
    "gtin",
    "lookup",
    "preview",
    "ranking",
    "scanGate",
    "serving",
    "types",
    "warnings",
  ]) {
    assert.match(index, new RegExp(`export \\* from "\\./${moduleName}"`));
  }

  const gtin = source("src/domain/barcode/gtin.ts");
  assert.match(gtin, /calculateGtinCheckDigit/);
  assert.match(gtin, /expandUpceToUpca/);
  assert.match(gtin, /canonicalGtin14:\s*compact\.padStart\(14, "0"\)/);
  assert.match(gtin, /suppliedCheckDigit !== expectedCheckDigit/);
  assert.doesNotMatch(gtin, /480[\s'"`]|barcode.*(?:country|market)/i);
});

test("Phase 4 public RPCs have exact bounded signatures and server-derived identity", () => {
  const contracts = {
    lookup_barcode_candidates: ["p_barcode", "p_market_country_code"],
    create_barcode_food_log_preview: [
      "p_scan_session_id",
      "p_food_product_id",
      "p_serving_id",
      "p_serving_count",
      "p_meal_type",
      "p_consumed_at",
      "p_time_zone",
      "p_original_description",
    ],
    revise_barcode_food_log_preview: [
      "p_preview_id",
      "p_expected_revision",
      "p_serving_id",
      "p_serving_count",
    ],
  };

  for (const [name, expected] of Object.entries(contracts)) {
    assert.deepEqual(parameterNames("public", name), expected, name);
    assert.ok(!expected.includes("p_user_id"), `${name} accepts user identity`);
    assert.ok(
      !expected.some((parameter) =>
        /^p_(?:total|calories|protein|carbohydrates|fat)/.test(parameter),
      ),
      `${name} accepts client nutrition totals`,
    );
    const wrapper = normalized(functionDefinition("public", name));
    assert.match(wrapper, /security invoker/);
    assert.doesNotMatch(wrapper, /security definer/);

    const helper = normalized(functionDefinition("private", name));
    assert.match(helper, /v_user_id uuid := \(select auth\.uid\(\)\)/);
    assert.match(helper, /security definer/);
    assert.match(helper, /set search_path = ''/);
  }
});

test("database GTIN comparison validates check digits and canonicalizes equivalent forms", () => {
  const normalizer = normalized(
    functionDefinition("private", "normalize_gtin"),
  );
  const validator = normalized(functionDefinition("private", "is_valid_gtin"));
  const lookup = normalized(
    functionDefinition("private", "lookup_barcode_candidates"),
  );

  assert.match(normalizer, /lpad\(barcode, 14, '0'\)/);
  assert.match(validator, /length\(barcode\) = 14/);
  assert.match(validator, /supplied_check_digit = expected_check_digit/);
  assert.match(lookup, /lpad\(product\.barcode, 14, '0'\) = v_barcode/);
  assert.doesNotMatch(
    migration,
    /(?:prefix|left\s*\(\s*[^,]*barcode)[\s\S]{0,120}(?:'ph'|'philippines')/i,
  );
});

test("lookup ranks saved private records first and preserves market/source warnings", () => {
  const lookup = normalized(
    functionDefinition("private", "lookup_barcode_candidates"),
  );
  const ownerRank = lookup.indexOf("case when option.user_id = v_user_id");
  const marketRank = lookup.indexOf(
    "case private.barcode_market_status(option.option_market)",
  );

  assert.ok(ownerRank >= 0, "missing owner-private rank tier");
  assert.ok(
    marketRank > ownerRank,
    "market tier must follow owner-private saved food",
  );
  assert.match(lookup, /when 'ph' then 300 when 'unknown' then 200 else 100/);
  assert.match(lookup, /provider_terms_reviewed_at/);
  assert.match(lookup, /provider_integration_status/);

  const warnings = source("src/domain/barcode/warnings.ts");
  for (const code of [
    "foreign_market",
    "unknown_market",
    "brand_mismatch",
    "stale_source",
    "freshness_unknown",
    "license_unknown",
    "license_blocked",
    "serving_unverified",
    "incomplete_macros",
    "fixture_only",
  ]) {
    assert.match(warnings, new RegExp(`code: "${code}"`));
  }
});

test("barcode preview and revisions cannot bypass current-preview confirmation", () => {
  const create = normalized(
    functionDefinition("private", "create_barcode_food_log_preview"),
  );
  const revise = normalized(
    functionDefinition("private", "revise_barcode_food_log_preview"),
  );
  const confirmation = normalized(
    source("supabase/migrations/20260712230402_phase_3_core_backend.sql"),
  );

  assert.match(create, /v_food\.calories \* p_serving_count/);
  assert.match(create, /v_user_id, 'barcode', 'ready', 1, v_presented_at/);
  assert.match(create, /presented_at, server_calculated_at/);
  assert.doesNotMatch(
    create,
    /p_total_|p_calories|p_protein_g|p_carbohydrates_g|p_fat_g/,
  );
  assert.doesNotMatch(migration, /insert into public\.food_entries/);

  assert.match(revise, /v_preview\.revision_number <> p_expected_revision/);
  assert.match(revise, /message = 'barcode preview revision is stale'/);
  assert.match(revise, /v_new_revision := p_expected_revision \+ 1/);
  assert.match(revise, /last_presented_at = v_presented_at/);

  assert.match(
    confirmation,
    /v_client_id is null and v_preview\.source_kind not in \('manual', 'barcode', 'saved_food'\)/,
  );
  assert.match(confirmation, /p_confirmation is distinct from true/);
  assert.match(
    confirmation,
    /v_preview\.revision_number <> p_confirmed_revision/,
  );
  assert.match(
    confirmation,
    /v_revision\.presented_at <> v_preview\.last_presented_at/,
  );

  const clientDecision = source("src/domain/barcode/preview.ts");
  assert.match(clientDecision, /permanentWrite:\s*false/g);
  assert.match(clientDecision, /rpc:\s*"confirm_food_log"/);
  assert.doesNotMatch(clientDecision, /user_id|p_total_|total_calories/i);
});

test("scanner uses authoritative debounce/checksum logic and exposes required fallbacks", () => {
  const scanner = source("src/features/barcode/BarcodeScannerFlow.tsx");
  assert.match(scanner, /createBarcodeScanGate/);
  assert.match(
    normalized(scanner),
    /tryaccept\( result\.data, date\.now\(\), result\.type as barcodesymbology, \)/,
  );
  assert.match(scanner, /Why camera access\?/);
  assert.match(scanner, /Saved foods/i);
  assert.match(scanner, /ChatGPT/i);
  assert.match(scanner, /Create server preview/);
  assert.match(scanner, /ManualPreviewCard/);
  assert.doesNotMatch(scanner, /\^\\d\{8,14\}\$/);

  const fallback = source("src/domain/barcode/lookup.ts");
  for (const action of [
    "manual_entry",
    "saved_foods",
    "chatgpt_nutrition_label",
  ]) {
    assert.match(fallback, new RegExp(`action: "${action}"`));
  }
});

test("all bundled Philippine product records are blocked-by-default mock fixtures", () => {
  const fixtures = source(
    "src/domain/barcode/fixtures/mockPhilippineProducts.ts",
  );
  const fixtureCount = [...fixtures.matchAll(/fixtureOnly:\s*true/g)].length;
  const recordCount = [...fixtures.matchAll(/id:\s*"mock-/g)].length;
  assert.ok(recordCount > 0);
  assert.equal(fixtureCount, recordCount);
  assert.match(
    fixtures,
    /MOCK FIXTURE ONLY - not live product or nutrition data/,
  );
  assert.match(fixtures, /Synthetic QA fixture/);

  const usability = source("src/domain/barcode/warnings.ts");
  assert.match(
    usability,
    /candidate\.fixtureOnly && !allowFixtureCandidates\) return false/,
  );
});

test("Phase 4 pgTAP plan matches its static assertion count", () => {
  const plan = Number(databaseTest.match(/select\s+plan\((\d+)\);/i)?.[1]);
  const assertions = [
    ...databaseTest.matchAll(
      /^\s*select\s+(?:ok|is|isnt|throws_ok|results_eq|lives_ok|has_table|has_column)\s*\(/gim,
    ),
  ].length;
  assert.equal(assertions, plan);
  assert.match(databaseTest, /^begin;/i);
  assert.match(databaseTest, /select \* from finish\(\);\s*rollback;\s*$/i);
});

test("Phase 4 artifacts contain no model API integration", () => {
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
        const contents = readFileSync(path, "utf8");
        for (const pattern of patterns) {
          if (pattern.test(contents))
            findings.push(`${relative(root, path)}: ${pattern}`);
        }
      }
    }
  }

  for (const directory of roots) scan(join(root, directory));
  assert.deepEqual(findings, []);
});
