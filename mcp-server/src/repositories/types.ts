import type { ProtectedAction, VerifiedPrincipal } from "../auth/types.js";

export interface RpcInvocation {
  action: ProtectedAction;
  params: Readonly<Record<string, unknown>>;
  principal: VerifiedPrincipal;
}

export interface NutritionRepository {
  readonly configured: boolean;
  invoke(invocation: RpcInvocation): Promise<unknown>;
}

export class RepositoryUnavailableError extends Error {
  constructor(message = "Nutrition repository is not configured.") {
    super(message);
    this.name = "RepositoryUnavailableError";
  }
}

export class RepositoryRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super("Nutrition repository request failed.");
    this.name = "RepositoryRequestError";
  }
}

export class LockedNutritionRepository implements NutritionRepository {
  readonly configured = false;

  async invoke(): Promise<never> {
    throw new RepositoryUnavailableError();
  }
}
