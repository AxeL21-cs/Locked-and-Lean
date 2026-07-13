import {
  calculateGtinCheckDigit,
  createBarcodeScanGate,
  expandUpceToUpca,
  normalizeGtin,
  normalizeScannedGtin,
} from "..";

describe("GTIN normalization", () => {
  it.each([
    ["96385074", "GTIN-8", "00000096385074"],
    ["036000291452", "UPC-A", "00036000291452"],
    ["4006381333931", "EAN-13", "04006381333931"],
    ["10012345000017", "GTIN-14", "10012345000017"],
  ])("validates %s as %s", (raw, format, canonicalGtin14) => {
    expect(normalizeGtin(raw)).toMatchObject({
      valid: true,
      digits: raw,
      format,
      canonicalGtin14,
    });
  });

  it("normalizes scanner spaces and hyphens without changing identity", () => {
    expect(normalizeGtin("4006 3813-33931")).toMatchObject({
      valid: true,
      digits: "4006381333931",
      canonicalGtin14: "04006381333931",
    });
  });

  it("rejects unsupported characters, lengths, and check digits", () => {
    expect(normalizeGtin("480ABC")).toMatchObject({
      valid: false,
      code: "non_numeric",
    });
    expect(normalizeGtin("1234567")).toMatchObject({
      valid: false,
      code: "unsupported_length",
    });
    expect(normalizeGtin("4006381333932")).toMatchObject({
      valid: false,
      code: "invalid_check_digit",
    });
  });

  it("calculates the GS1 modulo-10 check digit", () => {
    expect(calculateGtinCheckDigit("400638133393")).toBe(1);
    expect(() => calculateGtinCheckDigit("ABC")).toThrow(
      "GTIN body must contain digits only.",
    );
  });

  it("expands UPC-E to its equivalent validated UPC-A lookup identity", () => {
    expect(expandUpceToUpca("04252614")).toBe("042100005264");
    expect(normalizeScannedGtin("04252614", "upc_e")).toMatchObject({
      valid: true,
      format: "UPC-E",
      scannedDigits: "04252614",
      digits: "042100005264",
      canonicalGtin14: "00042100005264",
    });
    expect(normalizeScannedGtin("24252614", "upc_e")).toMatchObject({
      valid: false,
      code: "unsupported_length",
    });
  });
});

describe("barcode callback debounce", () => {
  it("suppresses the same canonical barcode within two seconds", () => {
    const gate = createBarcodeScanGate(2_000);

    expect(gate.tryAccept("4006381333931", 1_000)).toMatchObject({
      accepted: true,
    });
    expect(gate.tryAccept("4006 3813-33931", 2_999)).toEqual({
      accepted: false,
      reason: "duplicate_within_debounce_window",
    });
    expect(gate.tryAccept("4006381333931", 3_000)).toMatchObject({
      accepted: true,
    });
  });

  it("accepts a different valid barcode and supports explicit reset", () => {
    const gate = createBarcodeScanGate();
    expect(gate.tryAccept("4006381333931", 1_000).accepted).toBe(true);
    expect(gate.tryAccept("036000291452", 1_100).accepted).toBe(true);

    gate.reset("4006381333931");
    expect(gate.tryAccept("4006381333931", 1_200).accepted).toBe(true);
  });

  it("debounces equivalent UPC-E and UPC-A scans as one identity", () => {
    const gate = createBarcodeScanGate();
    expect(gate.tryAccept("04252614", 1_000, "upc_e")).toMatchObject({
      accepted: true,
      barcode: { digits: "042100005264", format: "UPC-E" },
    });
    expect(gate.tryAccept("042100005264", 2_000, "upc_a")).toEqual({
      accepted: false,
      reason: "duplicate_within_debounce_window",
    });
  });
});
