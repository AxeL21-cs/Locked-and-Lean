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
): Record<string, unknown> {
  switch (definition.name) {
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
        p_serving_id: input.serving_id,
        p_serving_count: input.serving_count,
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
): CallToolResult {
  switch (definition.name) {
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
      if (!preview) return missingRepositoryResult();
      return success(
        { preview, permanent_write: false },
        "A temporary preview is ready. No diary entry was created.",
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

function unsupportedBackendContract(): CallToolResult {
  return {
    isError: true,
    structuredContent: {
      code: "backend_contract_unavailable",
      permanent_write: false,
    },
    content: [
      {
        type: "text",
        text: "This preview workflow is unavailable because no reviewed OAuth-compatible backend RPC exists. No diary entry or preview was written.",
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
    if (
      definition.action === "preview_food_log" ||
      definition.action === "revise_food_log_preview"
    ) {
      return unsupportedBackendContract();
    }
    const value = await context.repository.invoke({
      action: definition.action,
      principal,
      params: repositoryParams(
        definition,
        parsed.data as Record<string, unknown>,
      ),
    });
    return shapeResult(definition, value);
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      return createAuthenticationToolResult({
        protectedResourceMetadataUrl: context.protectedResourceMetadataUrl,
        error: challengeErrorForCode(error.code),
        description:
          error.code === "client_action_denied"
            ? "This OAuth client is not authorized for the requested action."
            : "A valid linked account is required.",
      });
    }
    if (
      error instanceof RepositoryRequestError &&
      (error.status === 401 || error.status === 403)
    ) {
      return createAuthenticationToolResult({
        protectedResourceMetadataUrl: context.protectedResourceMetadataUrl,
        error: "insufficient_scope",
        description: "The linked account is not authorized for this action.",
      });
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
