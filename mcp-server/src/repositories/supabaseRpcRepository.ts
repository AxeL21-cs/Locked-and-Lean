import type { ProtectedAction } from "../auth/types.js";
import {
  RepositoryRequestError,
  type NutritionRepository,
  type RpcInvocation,
} from "./types.js";

export const RPC_BY_ACTION: Readonly<Partial<Record<ProtectedAction, string>>> =
  {
    get_calendar_history: "get_calendar_history",
    get_day_history: "get_day_history",
    get_progress_summary: "get_progress_summary",
    get_weight_trend: "get_weight_trend",
    confirm_food_log: "confirm_food_log",
    record_weight: "record_weight",
    delete_food_entry: "delete_food_entry",
  };

export interface SupabaseRpcRepositoryOptions {
  supabaseUrl: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
}

export class SupabaseRpcRepository implements NutritionRepository {
  readonly configured = true;
  private readonly fetch: typeof globalThis.fetch;

  constructor(private readonly options: SupabaseRpcRepositoryOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async invoke(invocation: RpcInvocation): Promise<unknown> {
    const rpc = RPC_BY_ACTION[invocation.action];
    if (!rpc) {
      throw new RepositoryRequestError(501, "backend_contract_unavailable");
    }
    const response = await this.fetch(
      `${this.options.supabaseUrl}/rest/v1/rpc/${rpc}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${invocation.principal.accessToken}`,
          apikey: this.options.publishableKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(invocation.params),
      },
    );

    if (!response.ok) {
      let code = "repository_error";
      try {
        const body: unknown = await response.json();
        if (
          body &&
          typeof body === "object" &&
          "code" in body &&
          typeof body.code === "string"
        ) {
          code = body.code.slice(0, 64);
        }
      } catch {
        // The response body is deliberately not surfaced or logged.
      }
      throw new RepositoryRequestError(response.status, code);
    }
    return response.status === 204 ? null : response.json();
  }
}
