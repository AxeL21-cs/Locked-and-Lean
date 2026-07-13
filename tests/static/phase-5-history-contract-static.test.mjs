import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const migration = source(
  "supabase/migrations/20260713000921_phase_5_calendar_progress.sql",
);
const confirmationMigration = source(
  "supabase/migrations/20260712230402_phase_3_core_backend.sql",
);

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

test("history domain exports deterministic Manila calendar contracts", () => {
  const index = source("src/domain/history/index.ts");
  for (const moduleName of [
    "calendar",
    "copy",
    "manilaDate",
    "series",
    "snapshots",
    "status",
    "types",
  ]) {
    assert.match(index, new RegExp(`export \\* from "\\./${moduleName}"`));
  }

  const dates = source("src/domain/history/manilaDate.ts");
  assert.match(dates, /PHILIPPINES_TIMEZONE/);
  assert.match(dates, /Intl\.DateTimeFormat/);
  assert.match(dates, /Date\.UTC/);
  assert.match(dates, /startInclusive/);
  assert.match(dates, /endExclusive/);
  assert.doesNotMatch(dates, /toISOString\(\)\.slice\(0,\s*10\)/);
  assert.doesNotMatch(dates, /getTimezoneOffset/);
});

test("calendar and chart meanings are not color-only", () => {
  const statuses = source("src/domain/history/status.ts");
  for (const label of [
    "Within target",
    "Below target",
    "Above target",
    "Incomplete",
    "No records",
  ]) {
    assert.match(statuses, new RegExp(`label: "${label}"`));
  }
  assert.equal([...statuses.matchAll(/symbol:\s*"[^"]+"/g)].length, 5);
  assert.equal(
    [...statuses.matchAll(/accessibilityLabel:\s*"[^"]+"/g)].length,
    5,
  );
  assert.equal([...statuses.matchAll(/colorToken:\s*"[^"]+"/g)].length, 5);

  const series = source("src/domain/history/series.ts");
  assert.match(series, /markerShape:\s*"gap"/);
  assert.match(series, /\? "circle" : "triangle"/);
  assert.match(series, /markerShape:\s*"circle"/);
  assert.match(series, /visibleLabel:\s*"No records"/);
  assert.match(series, /visibleLabel:\s*"No weight"/);
  assert.match(series, /rollingAverageKg:\s*null/);
});

test("Phase 5 public RPCs have bounded signatures and server-derived owners", () => {
  const contracts = {
    get_calendar_history: ["p_start_date", "p_end_date"],
    get_day_history: ["p_local_date"],
    get_weight_trend: ["p_start_date", "p_end_date"],
    get_progress_summary: ["p_start_date", "p_end_date"],
    copy_food_entry_to_preview: ["p_entry_id", "p_meal_type", "p_consumed_at"],
    create_food_entry_edit_preview: [
      "p_entry_id",
      "p_meal_type",
      "p_consumed_at",
      "p_original_description",
      "p_items",
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
    assert.match(
      normalized(functionDefinition("public", name)),
      /security invoker/,
    );
    const helper = normalized(functionDefinition("private", name));
    assert.match(helper, /v_user_id uuid := \(select auth\.uid\(\)\)/);
    assert.match(helper, /security definer/);
    assert.match(helper, /set search_path = ''/);
  }
});

test("history reads derive Manila dates and preserve null immutable snapshots", () => {
  const calendar = normalized(
    functionDefinition("private", "get_calendar_history"),
  );
  const day = normalized(functionDefinition("private", "get_day_history"));
  const weights = normalized(functionDefinition("private", "get_weight_trend"));
  const progress = normalized(
    functionDefinition("private", "get_progress_summary"),
  );

  for (const definition of [calendar, day, weights, progress]) {
    assert.match(definition, /at time zone 'asia\/manila'/);
  }
  assert.match(calendar, /entry\.deleted_at is null/);
  assert.match(day, /entry\.deleted_at is null/);
  assert.match(progress, /entry\.deleted_at is null/);
  assert.match(calendar, /else null::numeric/);
  assert.match(progress, /else null end as protein_g/);
  assert.match(day, /'provider_version', snapshot\.provider_version/);
  assert.match(day, /'provider_retrieved_at', snapshot\.provider_retrieved_at/);
  assert.match(day, /'attribution', snapshot\.attribution/);
  assert.match(day, /'uncertainty', snapshot\.uncertainty/);
  assert.doesNotMatch(day, /join public\.food_products/);
});

test("copy and edit create presented previews but cannot bypass confirmation", () => {
  const copy = normalized(
    functionDefinition("private", "copy_food_entry_to_preview"),
  );
  const edit = normalized(
    functionDefinition("private", "create_food_entry_edit_preview"),
  );
  const replacement = normalized(
    functionDefinition("private", "replace_history_source_on_confirmation"),
  );
  const confirmation = normalized(confirmationMigration);

  assert.match(copy, /'copy', v_source\.id/);
  assert.match(copy, /status = 'ready'/);
  assert.match(copy, /last_presented_at = v_presented_at/);
  assert.match(copy, /private\.preview_items_snapshot_json/);
  assert.match(edit, /history_intent = 'replace'/);
  assert.match(edit, /source_food_entry_id = v_source\.id/);
  assert.match(edit, /private\.create_manual_food_log_preview/);
  assert.doesNotMatch(migration, /insert into public\.food_entries/);

  assert.match(replacement, /new\.status = 'confirmed'/);
  assert.match(replacement, /new\.history_intent = 'replace'/);
  assert.match(replacement, /set deleted_at = clock_timestamp\(\)/);
  assert.match(confirmation, /p_confirmation is distinct from true/);
  assert.match(
    confirmation,
    /v_preview\.revision_number <> p_confirmed_revision/,
  );
  assert.match(
    confirmation,
    /v_revision\.presented_at <> v_preview\.last_presented_at/,
  );

  const intent = source("src/domain/history/copy.ts");
  assert.match(intent, /rpc:\s*"copy_food_entry_to_preview"/);
  assert.match(intent, /permanentWrite:\s*false/);
  assert.match(intent, /confirmationRequired:\s*true/);
  assert.doesNotMatch(intent, /user_id|p_total_|total_calories/i);
});

test("mobile routes use the history RPC adapter and accessible feature views", () => {
  const adapter = source("src/services/supabase/adapter.ts");
  for (const rpc of [
    "get_calendar_history",
    "get_day_history",
    "get_weight_trend",
    "get_progress_summary",
    "copy_food_entry_to_preview",
    "create_food_entry_edit_preview",
  ]) {
    assert.match(adapter, new RegExp(`rpc\\(\"${rpc}\"`));
  }

  const calendarRoute = source("app/(tabs)/calendar.tsx");
  assert.match(calendarRoute, /<HistoryCalendar/);
  assert.match(calendarRoute, /mobileApi\.getCalendarHistory/);
  assert.match(calendarRoute, /mobileApi\.getDayHistory/);
  assert.match(calendarRoute, /mobileApi\.copyFoodEntryToPreview/);
  assert.match(calendarRoute, /mobileApi\.createFoodEntryEditPreview/);
  assert.match(calendarRoute, /mobileApi\.deleteFoodEntry/);

  const progressRoute = source("app/(tabs)/progress.tsx");
  assert.match(progressRoute, /<ProgressDashboard/);
  assert.match(progressRoute, /mobileApi\.getProgressSummary/);
  assert.match(progressRoute, /mobileApi\.getCalendarHistory/);
  assert.match(progressRoute, /mobileApi\.getWeightTrend/);

  const calendar = source("src/features/calendar/HistoryCalendar.tsx");
  assert.match(calendar, /accessibilityLabel/);
  assert.match(calendar, /day\.status\.symbol/);
  assert.match(calendar, /day\.status\.label/);
  assert.match(calendar, />Edit</);
  assert.match(calendar, />Copy</);
  assert.match(calendar, />Delete</);
  assert.match(calendar, /confirmed snapshot/i);

  const progress = source("src/features/progress/ProgressDashboard.tsx");
  assert.match(progress, /accessibilityLabel/);
  assert.match(progress, /day\.status\.symbol/);
  assert.match(progress, /Unknown/);
  assert.match(
    progress,
    /incomplete days\s+are excluded, never filled with zero/,
  );
  assert.match(progress, /Gaps remain gaps and no trend is\s+invented/);
});

test("Phase 5 pgTAP plans match their assertion counts", () => {
  for (const path of [
    "supabase/tests/database/phase_5_calendar_progress.test.sql",
    "supabase/tests/database/phase_5_qa.test.sql",
  ]) {
    const databaseTest = source(path);
    const plan = Number(databaseTest.match(/select\s+plan\((\d+)\);/i)?.[1]);
    const assertions = [
      ...databaseTest.matchAll(
        /^\s*select\s+(?:ok|is|isnt|throws_ok|results_eq|lives_ok|has_table|has_column|has_index)\s*\(/gim,
      ),
    ].length;
    assert.equal(assertions, plan, path);
    assert.match(databaseTest, /^begin;/i);
    assert.match(databaseTest, /select \* from finish\(\);\s*rollback;\s*$/i);
  }
});
