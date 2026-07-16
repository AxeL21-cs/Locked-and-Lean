import { z } from "zod";

import type { ProtectedAction } from "../auth/types.js";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a Manila local date in YYYY-MM-DD form.");
const instantSchema = z.iso.datetime({ offset: true });
const uuidSchema = z.uuid();
const jsonRecordSchema = z.record(z.string(), z.unknown());
const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const foodItemSchema = z
  .object({
    food_name: z.string().trim().min(1).max(300),
    brand_name: z.string().trim().min(1).max(300).nullable().optional(),
    quantity: z.number().positive().max(1000),
    unit: z.string().trim().min(1).max(80),
    serving_description: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable()
      .optional(),
    serving_weight_g: z.number().positive().max(100000).nullable().optional(),
    calories: z.number().min(0).max(100000),
    protein_g: z.number().min(0).max(10000).nullable().optional(),
    carbohydrates_g: z.number().min(0).max(10000).nullable().optional(),
    fat_g: z.number().min(0).max(10000).nullable().optional(),
    is_estimated: z.literal(true).optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    uncertainty: z
      .union([z.array(z.unknown()).max(50), jsonRecordSchema])
      .optional(),
  })
  .strict();

const calendarDaySchema = z
  .object({
    local_date: dateSchema,
    entry_count: z.number().int().nonnegative(),
    consumed_calories: z.number().nonnegative(),
    consumed_protein_g: z.number().nonnegative().nullable(),
    consumed_carbohydrates_g: z.number().nonnegative().nullable(),
    consumed_fat_g: z.number().nonnegative().nullable(),
    macro_data_complete: z.boolean(),
    calorie_target: z.number().nullable(),
    protein_target_g: z.number().nullable(),
    carbohydrate_target_g: z.number().nullable(),
    fat_target_g: z.number().nullable(),
    weight_kg: z.number().nullable(),
    has_entries: z.boolean(),
    manila_time_zone: z.literal("Asia/Manila"),
    server_calculated_at: z.string(),
  })
  .passthrough();

export type SecurityScheme =
  { type: "noauth" } | { type: "oauth2"; scopes: readonly string[] };

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  action: ProtectedAction | null;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  securitySchemes: readonly SecurityScheme[];
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
    idempotentHint?: boolean;
  };
  status: { invoking: string; invoked: string };
}

const protectedSchemes = [{ type: "oauth2", scopes: ["openid"] }] as const;

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: "health",
    title: "Check Locked and Lean service health",
    description:
      "Returns configuration/readiness status only. It never returns user nutrition data or secrets.",
    action: null,
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({
      status: z.enum(["ok", "locked", "degraded"]),
      authentication: z.enum(["configured", "locked"]),
      repository: z.enum(["configured", "locked"]),
      production_ready: z.literal(false),
      blockers: z.array(z.string()),
    }),
    securitySchemes: [{ type: "noauth" }],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: { invoking: "Checking health…", invoked: "Health checked" },
  },
  {
    name: "get_today_calories",
    title: "Read today's calorie status",
    description:
      "Reads the authenticated user's server-calculated calorie total and active target for the current Asia/Manila calendar day. It never changes history.",
    action: "get_calendar_history",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({
      local_date: dateSchema,
      consumed_calories: z.number().nonnegative(),
      calorie_target: z.number().nullable(),
      calories_remaining: z.number().nullable(),
      entry_count: z.number().int().nonnegative(),
      manila_time_zone: z.literal("Asia/Manila"),
    }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: {
      invoking: "Reading today's calories…",
      invoked: "Calories ready",
    },
  },
  {
    name: "get_weekly_protein_average",
    title: "Read seven-day protein average",
    description:
      "Reads the current Asia/Manila day and six preceding calendar days, then returns a daily protein average only when macro data is complete for all seven days. It never changes history.",
    action: "get_calendar_history",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({
      start_date: dateSchema,
      end_date: dateSchema,
      calendar_day_count: z.literal(7),
      days_with_entries: z.number().int().min(0).max(7),
      total_protein_g: z.number().nonnegative().nullable(),
      average_daily_protein_g: z.number().nonnegative().nullable(),
      macro_data_complete: z.boolean(),
      incomplete_dates: z.array(dateSchema),
      manila_time_zone: z.literal("Asia/Manila"),
    }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: {
      invoking: "Reading weekly protein…",
      invoked: "Protein average ready",
    },
  },
  {
    name: "get_calendar_history",
    title: "Read calorie and macro calendar",
    description:
      "Reads owner-scoped Manila daily summaries for a bounded date range. It never changes history.",
    action: "get_calendar_history",
    inputSchema: z
      .object({ start_date: dateSchema, end_date: dateSchema })
      .strict(),
    outputSchema: z.object({ days: z.array(calendarDaySchema) }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: { invoking: "Reading calendar…", invoked: "Calendar ready" },
  },
  {
    name: "get_day_history",
    title: "Read confirmed food entries for a day",
    description:
      "Reads active immutable entry and item snapshots for one Asia/Manila date.",
    action: "get_day_history",
    inputSchema: z.object({ local_date: dateSchema }).strict(),
    outputSchema: z.object({ entries: z.array(jsonRecordSchema) }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: {
      invoking: "Reading food history…",
      invoked: "Food history ready",
    },
  },
  {
    name: "get_progress_summary",
    title: "Read calorie and weight progress summary",
    description:
      "Reads owner-scoped progress aggregates over a bounded Manila date range without interpolation.",
    action: "get_progress_summary",
    inputSchema: z
      .object({ start_date: dateSchema, end_date: dateSchema })
      .strict(),
    outputSchema: z.object({ summary: jsonRecordSchema.nullable() }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: { invoking: "Reading progress…", invoked: "Progress ready" },
  },
  {
    name: "get_weight_trend",
    title: "Read measured weight trend",
    description:
      "Reads actual owner weight measurements and changes for a bounded Manila date range. Missing dates are not invented.",
    action: "get_weight_trend",
    inputSchema: z
      .object({ start_date: dateSchema, end_date: dateSchema })
      .strict(),
    outputSchema: z.object({ points: z.array(jsonRecordSchema) }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: {
      invoking: "Reading weight trend…",
      invoked: "Weight trend ready",
    },
  },
  {
    name: "preview_food_log",
    title: "Create a food-log preview",
    description:
      "Creates a temporary estimate from complete item-level nutrition, marks every item as estimated, and calculates totals on the server. It cannot create a diary entry. Show every returned item, uncertainty, meal, time, and total before asking the user to confirm that exact revision.",
    action: "preview_food_log",
    inputSchema: z
      .object({
        meal_type: mealTypeSchema,
        consumed_at: instantSchema,
        original_description: z.string().trim().min(1).max(4000),
        items: z.array(foodItemSchema).min(1).max(100),
      })
      .strict(),
    outputSchema: z.object({
      preview: jsonRecordSchema,
      permanent_write: z.literal(false),
    }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: { invoking: "Building preview…", invoked: "Preview ready" },
  },
  {
    name: "revise_food_log_preview",
    title: "Revise a food-log preview",
    description:
      "Replaces a ChatGPT preview with one complete corrected snapshot and returns the next immutable revision. Include all unchanged and changed items. The prior revision becomes stale and cannot be confirmed; show the complete returned revision before asking again for confirmation.",
    action: "revise_food_log_preview",
    inputSchema: z
      .object({
        preview_id: uuidSchema,
        expected_revision: z.number().int().positive(),
        meal_type: mealTypeSchema,
        consumed_at: instantSchema,
        original_description: z.string().trim().min(1).max(4000),
        items: z.array(foodItemSchema).min(1).max(100),
      })
      .strict(),
    outputSchema: z.object({
      preview: jsonRecordSchema,
      permanent_write: z.literal(false),
    }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
    status: { invoking: "Revising preview…", invoked: "Revision ready" },
  },
  {
    name: "confirm_food_log",
    title: "Confirm the exact food-log revision",
    description:
      "Permanently logs only the exact current revision after the user has seen its complete server-returned preview and explicitly confirmed it in a later message or approval step. Never call this in the same step that creates or revises a preview. Reuse the same idempotency key only for an identical retry.",
    action: "confirm_food_log",
    inputSchema: z
      .object({
        preview_id: uuidSchema,
        confirmed_revision: z.number().int().positive(),
        confirmation: z.literal(true),
        idempotency_key: z.string().min(8).max(200),
      })
      .strict(),
    outputSchema: z.object({ confirmation: jsonRecordSchema }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: true,
    },
    status: { invoking: "Confirming food log…", invoked: "Food log confirmed" },
  },
  {
    name: "record_weight",
    title: "Record a body-weight measurement",
    description:
      "Records one owner-scoped metric weight measurement using the fixed Asia/Manila diary boundary and an idempotency key.",
    action: "record_weight",
    inputSchema: z
      .object({
        measured_at: instantSchema,
        weight_kg: z.number().min(20).max(500),
        idempotency_key: z.string().min(8).max(200),
      })
      .strict(),
    outputSchema: z.object({ measurement: jsonRecordSchema }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: true,
    },
    status: { invoking: "Recording weight…", invoked: "Weight recorded" },
  },
  {
    name: "delete_food_entry",
    title: "Delete a confirmed food entry",
    description:
      "Soft-deletes one owned confirmed entry and recalculates its summary. This destructive action requires explicit current confirmation.",
    action: "delete_food_entry",
    inputSchema: z
      .object({ entry_id: uuidSchema, confirmation: z.literal(true) })
      .strict(),
    outputSchema: z.object({ deletion: jsonRecordSchema }),
    securitySchemes: protectedSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
      idempotentHint: true,
    },
    status: { invoking: "Deleting entry…", invoked: "Entry deleted" },
  },
] as const;

export const TOOL_DEFINITION_BY_NAME = new Map(
  TOOL_DEFINITIONS.map((definition) => [definition.name, definition]),
);
