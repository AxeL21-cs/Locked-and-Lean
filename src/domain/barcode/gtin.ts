import type {
  BarcodeSymbology,
  GtinFormat,
  GtinNormalizationResult,
  InvalidGtin,
} from "./types";

const FORMAT_BY_LENGTH: Readonly<Record<number, GtinFormat>> = {
  8: "GTIN-8",
  12: "UPC-A",
  13: "EAN-13",
  14: "GTIN-14",
};

function invalid(
  raw: string,
  code: InvalidGtin["code"],
  message: string,
): InvalidGtin {
  return { valid: false, raw, code, message };
}

export function calculateGtinCheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) {
    throw new Error("GTIN body must contain digits only.");
  }

  const sum = [...body].reverse().reduce((total, digit, index) => {
    const weight = index % 2 === 0 ? 3 : 1;
    return total + Number(digit) * weight;
  }, 0);

  return (10 - (sum % 10)) % 10;
}

export function normalizeGtin(raw: string): GtinNormalizationResult {
  const compact = raw
    .normalize("NFKC")
    .replace(/[\s-]+/g, "")
    .trim();
  if (compact.length === 0) {
    return invalid(raw, "empty", "Enter or scan a barcode.");
  }
  if (!/^\d+$/.test(compact)) {
    return invalid(raw, "non_numeric", "A GTIN may contain digits only.");
  }

  const format = FORMAT_BY_LENGTH[compact.length];
  if (!format) {
    return invalid(
      raw,
      "unsupported_length",
      "Supported barcode lengths are GTIN-8, UPC-A, EAN-13, and GTIN-14.",
    );
  }

  const body = compact.slice(0, -1);
  const suppliedCheckDigit = Number(compact.at(-1));
  const expectedCheckDigit = calculateGtinCheckDigit(body);
  if (suppliedCheckDigit !== expectedCheckDigit) {
    return invalid(
      raw,
      "invalid_check_digit",
      "The barcode check digit is invalid. Scan again or enter it manually.",
    );
  }

  return {
    valid: true,
    raw,
    digits: compact,
    canonicalGtin14: compact.padStart(14, "0"),
    format,
    checkDigit: suppliedCheckDigit,
  };
}

export function expandUpceToUpca(rawUpce: string): string | null {
  const upce = rawUpce
    .normalize("NFKC")
    .replace(/[\s-]+/g, "")
    .trim();
  if (!/^\d{8}$/.test(upce)) return null;
  const numberSystem = upce[0];
  const data = upce.slice(1, 7);
  const checkDigit = upce[7];
  if (
    !numberSystem ||
    !data ||
    !checkDigit ||
    !["0", "1"].includes(numberSystem)
  )
    return null;

  const [d1, d2, d3, d4, d5, d6] = data;
  if (!d1 || !d2 || !d3 || !d4 || !d5 || !d6) return null;
  let manufacturer: string;
  let product: string;
  if (["0", "1", "2"].includes(d6)) {
    manufacturer = `${d1}${d2}${d6}00`;
    product = `00${d3}${d4}${d5}`;
  } else if (d6 === "3") {
    manufacturer = `${d1}${d2}${d3}00`;
    product = `000${d4}${d5}`;
  } else if (d6 === "4") {
    manufacturer = `${d1}${d2}${d3}${d4}0`;
    product = `0000${d5}`;
  } else {
    manufacturer = `${d1}${d2}${d3}${d4}${d5}`;
    product = `0000${d6}`;
  }

  return `${numberSystem}${manufacturer}${product}${checkDigit}`;
}

export function normalizeScannedGtin(
  raw: string,
  symbology?: BarcodeSymbology,
): GtinNormalizationResult {
  if (symbology !== "upc_e") return normalizeGtin(raw);
  const expanded = expandUpceToUpca(raw);
  if (!expanded) {
    return invalid(
      raw,
      "unsupported_length",
      "UPC-E must contain a supported number system and eight digits.",
    );
  }
  const normalized = normalizeGtin(expanded);
  if (!normalized.valid) return { ...normalized, raw };
  return {
    ...normalized,
    raw,
    scannedDigits: raw
      .normalize("NFKC")
      .replace(/[\s-]+/g, "")
      .trim(),
    format: "UPC-E",
  };
}
