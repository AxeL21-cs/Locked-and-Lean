import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

export function zodResolver<T extends FieldValues>(
  schema: ZodType<T>,
): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { errors: {}, values: result.data };

    const errors = Object.fromEntries(
      result.error.issues.map((issue) => [
        String(issue.path[0] ?? "root"),
        { message: issue.message, type: issue.code },
      ]),
    ) as FieldErrors<T>;
    return {
      values: {},
      errors,
    };
  };
}
