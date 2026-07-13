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

export function toMobileApiError(error: unknown): MobileApiError {
  if (error instanceof MobileApiError) return error;
  const message =
    error instanceof Error ? error.message : "Unexpected service error.";
  const lower = message.toLowerCase();
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
  if (
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
