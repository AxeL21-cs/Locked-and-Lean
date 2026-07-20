export class MobileApiError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "configuration"
      | "offline"
      | "authentication"
      | "validation"
      | "conflict"
      | "server",
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

function errorField(
  error: unknown,
  field: "code" | "message",
): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function toMobileApiError(error: unknown): MobileApiError {
  if (error instanceof MobileApiError) return error;
  const message =
    (error instanceof Error && error.message.trim()
      ? error.message.trim()
      : errorField(error, "message")) ?? "Unexpected service error.";
  const code = errorField(error, "code")?.toUpperCase();
  const lower = message.toLowerCase();
  if (
    code === "PGRST202" ||
    lower.includes("could not find the function") ||
    (lower.includes("function") && lower.includes("schema cache"))
  ) {
    return new MobileApiError(
      "This version of Locked and Lean no longer matches the service. Refresh the web app or install the latest Android update, then try again.",
      "configuration",
    );
  }
  if (lower.includes("not configured") || lower.includes("project url")) {
    return new MobileApiError(message, "configuration");
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("offline")
  ) {
    return new MobileApiError(
      "You appear to be offline. Check your connection and retry.",
      "offline",
      true,
    );
  }
  if (code === "22023") {
    return new MobileApiError(message, "validation");
  }
  if (
    code === "42501" ||
    lower.includes("auth") ||
    lower.includes("password") ||
    lower.includes("credential")
  ) {
    return new MobileApiError(message, "authentication");
  }
  if (
    lower.includes("stale") ||
    lower.includes("revision") ||
    lower.includes("conflict")
  ) {
    return new MobileApiError(message, "conflict");
  }
  return new MobileApiError(message, "server", true);
}
