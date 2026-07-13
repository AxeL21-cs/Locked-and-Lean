export type ConfirmationClassification =
  "explicit_confirmation" | "ambiguous" | "not_confirmation";

const EXPLICIT_PHRASES = new Set([
  "yes",
  "correct",
  "tama",
  "tama yan",
  "oo",
  "i log mo",
  "log it",
  "save it",
  "okay na yan log it",
  "accurate yan",
]);

const AMBIGUOUS_PHRASES = new Set([
  "siguro",
  "parang tama",
  "pwede na",
  "bahala na",
  "mga ganun",
  "close enough",
]);

function normalizeConfirmationPhrase(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-PH")
    .replace(/[’']/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyConfirmationPhrase(
  phrase: string,
): ConfirmationClassification {
  const normalized = normalizeConfirmationPhrase(phrase);
  if (EXPLICIT_PHRASES.has(normalized)) return "explicit_confirmation";
  if (AMBIGUOUS_PHRASES.has(normalized)) return "ambiguous";
  return "not_confirmation";
}
