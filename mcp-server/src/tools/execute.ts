import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  challengeErrorForCode,
  createAuthenticationToolResult,
} from "../auth/challenge.js";
import {
  TokenVerificationError,
  type AccessTokenVerifier,
} from "../auth/types.js";
import {
  RepositoryRequestError,
  RepositoryUnavailableError,
  type NutritionRepository,
} from "../repositories/types.js";
import { TOOL_DEFINITION_BY_NAME, type ToolDefinition } from "./catalog.js";

export interface ToolExecutionContext {
  accessToken: string | null;
  protectedResourceMetadataUrl: string | null;
  verifier: AccessTokenVerifier;
  repository: NutritionRepository;
  health: {
    authConfigured: boolean;
    repositoryConfigured: boolean;
    productionReady: false;
    blockers: readonly string[];
  };
  now?: () => Date;
}

function manilaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function finiteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  return records(value)[0] ?? null;
}

function success(
  structuredContent: Record<string, unknown>,
  text: string,
): CallToolResult {
  return {
    structuredContent,
    content: [{ type: "text", text }],
  };
}

function missingRepositoryResult(): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "The repository did not return the required server-owned result.",
      },
    ],
  };
}

function repositoryParams(
  definition: ToolDefinition,
  input: Record<string, unknown>,
  today: string,
): Record<string, unknown> {
  switch (definition.name) {
    case "get_today_calories":
      return { p_start_date: today, p_end_date: today };
    case "get_weekly_protein_average":
      return { p_start_date: addDays(today, -6), p_end_date: today };
    case "get_calendar_history":
    case "get_progress_summary":
    case "get_weight_trend":
      return {
        p_start_date: input.start_date,
        p_end_date: input.end_date,
      };
    case "get_day_history":
      return { p_local_date: input.local_date };
    case "preview_food_log":
      return {
        p_meal_type: input.meal_type,
        p_consumed_at: input.consumed_at,
        p_time_zone: "Asia/Manila",
        p_original_description: input.original_description,
        p_items: input.items,
      };
    case "revise_food_log_preview":
      return {
        p_preview_id: input.preview_id,
        p_expected_revision: input.expected_revision,
        p_meal_type: input.meal_type,
        p_consumed_at: input.consumed_at,
        p_time_zone: "Asia/Manila",
        p_original_description: input.original_description,
        p_items: input.items,
      };
    case "confirm_food_log":
      return {
        p_preview_id: input.preview_id,
        p_confirmed_revision: input.confirmed_revision,
        p_confirmation: input.confirmation,
        p_idempotency_key: input.idempotency_key,
      };
    case "record_weight":
      return {
        p_measured_at: input.measured_at,
        p_time_zone: "Asia/Manila",
        p_weight_kg: input.weight_kg,
        p_idempotency_key: input.idempotency_key,
      };
    case "delete_food_entry":
      return {
        p_entry_id: input.entry_id,
        p_confirmation: input.confirmation,
      };
    default:
      return {};
  }
}

function shapeResult(
  definition: ToolDefinition,
  value: unknown,
  today: string,
): CallToolResult {
  switch (definition.name) {
    case "get_today_calories": {
      const day = firstRecord(value);
      if (!day || day.local_date !== today) return missingRepositoryResult();
      const consumed = finiteNumber(day.consumed_calories);
      const target = finiteNumber(day.calorie_target);
      const entryCount = finiteNumber(day.entry_count);
      if (consumed === null || consumed < 0 || entryCount === null) {
        return missingRepositoryResult();
      }
      const structuredContent = {
        local_date: today,
        consumed_calories: consumed,
        calorie_target: target,
        calories_remaining: target === null ? null : target - consumed,
        entry_count: entryCount,
        manila_time_zone: "Asia/Manila" as const,
      };
      return success(
        structuredContent,
        target === null
          ? `${consumed} calories have been logged today. No active calorie target was returned.`
          : `${consumed} calories have been logged today; ${target - consumed} remain relative to the active target.`,
      );
    }
    case "get_weekly_protein_average": {
      const startDate = addDays(today, -6);
      const days = records(value);
      const byDate = new Map(days.map((day) => [String(day.local_date), day]));
      const dates = Array.from({ length: 7 }, (_, index) =>
        addDays(startDate, index),
      );
      const incompleteDates = dates.filter((date) => {
        const day = byDate.get(date);
        return (
          !day ||
          day.macro_data_complete !== true ||
          finiteNumber(day.consumed_protein_g) === null
        );
      });
      const complete = incompleteDates.length === 0;
      const total = complete
        ? dates.reduce(
            (sum, date) =>
              sum + (finiteNumber(byDate.get(date)?.consumed_protein_g) ?? 0),
            0,
          )
        : null;
      const daysWithEntries = dates.filter(
        (date) => (finiteNumber(byDate.get(date)?.entry_count) ?? 0) > 0,
      ).length;
      const structuredContent = {
        start_date: startDate,
        end_date: today,
        calendar_day_count: 7 as const,
        days_with_entries: daysWithEntries,
        total_protein_g: total,
        average_daily_protein_g: total === null ? null : total / 7,
        macro_data_complete: complete,
        incomplete_dates: incompleteDates,
        manila_time_zone: "Asia/Manila" as const,
      };
      return success(
        structuredContent,
        complete
          ? `The seven-day daily protein average is ${total! / 7} grams.`
          : "A weekly protein average cannot be calculated because one or more days have incomplete macro data.",
      );
    }
    case "get_calendar_history": {
      const days = records(value);
      return success({ days }, `Read ${days.length} Manila calendar days.`);
    }
    case "get_day_history": {
      const entries = records(value);
      return success({ entries }, `Read ${entries.length} confirmed entries.`);
    }
    case "get_weight_trend": {
      const points = records(value);
      return success(
        { points },
        `Read ${points.length} measured weight points.`,
      );
    }
    case "get_progress_summary":
      return success(
        { summary: firstRecord(value) },
        "Progress summary is ready.",
      );
    case "preview_food_log":
    case "revise_food_log_preview": {
      const preview = firstRecord(value);
      const revisionNumber = finiteNumber(preview?.revision_number);
      if (
        !preview ||
        preview.status !== "ready" ||
        revisionNumber === null ||
        revisionNumber < 1 ||
        finiteNumber(preview.total_calories) === null ||
        !Array.isArray(preview.items) ||
        preview.items.length < 1
      ) {
        return missingRepositoryResult();
      }
      return success(
        { preview, permanent_write: false },
        `Temporary revision ${revisionNumber} is ready. No diary entry was created. Show the complete returned snapshot and ask the user to confirm this exact revision before logging it.`,
      );
    }
    case "confirm_food_log": {
      const confirmation = firstRecord(value);
      if (!confirmation) return missingRepositoryResult();
      return success(
        { confirmation },
        "The exact presented revision was confirmed.",
      );
    }
    case "record_weight": {
      const measurement = firstRecord(value);
      if (!measurement) return missingRepositoryResult();
      return success({ measurement }, "The weight measurement was recorded.");
    }
    case "delete_food_entry": {
      const deletion = firstRecord(value);
      if (!deletion) return missingRepositoryResult();
      return success({ deletion }, "The owned entry was deleted.");
    }
    default:
      return {
        isError: true,
        content: [{ type: "text", text: "Unknown tool." }],
      };
  }
}

function configurationError(): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "This protected tool is not configured for runtime use.",
      },
    ],
  };
}

function authorizationDeniedResult(): CallToolResult {
  return {
    isError: true,
    structuredContent: { code: "authorization_denied" },
    content: [
      {
        type: "text",
        text: "The linked account or connector client is not authorized for this action. Reconnecting will not change a server-side policy denial.",
      },
    ],
  };
}

function repositoryValidationResult(): CallToolResult {
  return {
    isError: true,
    structuredContent: {
      code: "request_rejected",
    },
    content: [
      {
        type: "text",
        text: "The server rejected this request because the preview was invalid, stale, expired, or reused with different confirmation data. Review the current preview and try a corrected request; no unconfirmed diary entry was created.",
      },
    ],
  };
}

export async function executeTool(
  name: string,
  rawInput: unknown,
  context: ToolExecutionContext,
): Promise<CallToolResult> {
  const definition = TOOL_DEFINITION_BY_NAME.get(name);
  if (!definition) {
    return {
      isError: true,
      content: [{ type: "text", text: "Unknown tool." }],
    };
  }

  const parsed = definition.inputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      isError: true,
      content: [{ type: "text", text: "Tool input failed validation." }],
    };
  }

  if (definition.name === "health") {
    const status =
      !context.health.authConfigured || !context.health.repositoryConfigured
        ? "locked"
        : context.health.blockers.length > 0
          ? "degraded"
          : "ok";
    const structuredContent = {
      status,
      authentication: context.health.authConfigured ? "configured" : "locked",
      repository: context.health.repositoryConfigured ? "configured" : "locked",
      production_ready: false as const,
      blockers: [...context.health.blockers],
    };
    return success(structuredContent, `Service status: ${status}.`);
  }

  if (!definition.action || !context.protectedResourceMetadataUrl) {
    return configurationError();
  }

  try {
    const principal = await context.verifier.verify({
      accessToken: context.accessToken,
      action: definition.action,
      requiredScopes: ["openid"],
    });
    const today = manilaDate(context.now?.() ?? new Date());
    const value = await context.repository.invoke({
      action: definition.action,
      principal,
      params: repositoryParams(
        definition,
        parsed.data as Record<string, unknown>,
        today,
      ),
    });
    return shapeResult(definition, value, today);
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      if (error.code === "client_action_denied") {
        return {
          isError: true,
          structuredContent: { code: "oauth_client_not_approved" },
          content: [
            {
              type: "text",
              text: "This connector client is not approved for the requested action. Reconnecting will not change that policy; an administrator must approve this exact OAuth client ID.",
            },
          ],
        };
      }
      return createAuthenticationToolResult({
        protectedResourceMetadataUrl: context.protectedResourceMetadataUrl,
        error: challengeErrorForCode(error.code),
        description: "A valid linked account is required.",
        ...(error.code === "insufficient_scope" ? { scope: "openid" } : {}),
      });
    }
    if (error instanceof RepositoryRequestError && error.status === 401) {
      return createAuthenticationToolResult({
        protectedResourceMetadataUrl: context.protectedResourceMetadataUrl,
        error: "invalid_token",
        description:
          "The linked account token was rejected by the data service.",
      });
    }
    if (error instanceof RepositoryRequestError && error.status === 403) {
      return authorizationDeniedResult();
    }
    if (
      error instanceof RepositoryRequestError &&
      (error.status === 400 || error.status === 409 || error.status === 422)
    ) {
      return repositoryValidationResult();
    }
    if (
      error instanceof RepositoryUnavailableError ||
      error instanceof RepositoryRequestError
    ) {
      return configurationError();
    }
    return {
      isError: true,
      content: [
        { type: "text", text: "The tool request could not be completed." },
      ],
    };
  }
}
