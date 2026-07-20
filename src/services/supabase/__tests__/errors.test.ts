import { toMobileApiError } from "../errors";

describe("Supabase service error mapping", () => {
  it("turns a stale RPC signature into an actionable update message", () => {
    const result = toMobileApiError({
      code: "PGRST202",
      message:
        "Could not find the function public.propose_nutrition_target in the schema cache",
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "configuration",
        retryable: false,
        message: expect.stringContaining("install the latest Android update"),
      }),
    );
  });

  it("preserves structured validation messages returned by PostgREST", () => {
    const result = toMobileApiError({
      code: "22023",
      message: "target weight is invalid",
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "validation",
        message: "target weight is invalid",
      }),
    );
  });

  it("preserves useful messages from plain service-error objects", () => {
    const result = toMobileApiError({
      code: "XX000",
      message: "The service could not finish this request.",
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "server",
        retryable: true,
        message: "The service could not finish this request.",
      }),
    );
  });
});
