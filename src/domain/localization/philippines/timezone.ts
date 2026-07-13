export const PHILIPPINES_TIMEZONE = "Asia/Manila";

function validDate(value: Date | string): Date {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("A valid instant is required.");
  }
  return date;
}

export function localDateInManila(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHILIPPINES_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(validDate(value));
  const part = (type: "year" | "month" | "day"): string => {
    const result = parts.find((candidate) => candidate.type === type)?.value;
    if (!result)
      throw new RangeError(`Missing ${type} from timezone conversion.`);
    return result;
  };
  return `${part("year")}-${part("month")}-${part("day")}`;
}
