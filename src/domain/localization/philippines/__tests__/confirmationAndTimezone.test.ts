import {
  PHILIPPINES_TIMEZONE,
  classifyConfirmationPhrase,
  localDateInManila,
} from "..";

describe("explicit Philippine confirmation phrases", () => {
  it.each([
    "Yes",
    "Correct",
    "Tama",
    "Tama yan",
    "Oo",
    "I-log mo",
    "Log it",
    "Save it",
    "Okay na yan, log it",
    "Accurate yan",
  ])("classifies %s as explicit", (phrase) => {
    expect(classifyConfirmationPhrase(phrase)).toBe("explicit_confirmation");
  });

  it.each([
    "Siguro",
    "Parang tama",
    "Pwede na",
    "Bahala na",
    "Mga ganun",
    "Close enough",
  ])("classifies %s as ambiguous", (phrase) => {
    expect(classifyConfirmationPhrase(phrase)).toBe("ambiguous");
  });

  it("does not mistake agreement plus a correction for confirmation", () => {
    expect(classifyConfirmationPhrase("Tama pero walang gravy")).toBe(
      "not_confirmation",
    );
  });
});

describe("Asia/Manila date behavior", () => {
  it("uses the configured IANA timezone", () => {
    expect(PHILIPPINES_TIMEZONE).toBe("Asia/Manila");
  });

  it("moves a late UTC instant to the next Manila calendar date", () => {
    expect(localDateInManila("2026-07-12T16:30:00.000Z")).toBe("2026-07-13");
  });

  it("keeps an instant before the Manila midnight boundary on the prior date", () => {
    expect(localDateInManila("2026-07-12T15:59:59.999Z")).toBe("2026-07-12");
  });

  it("rejects invalid instants instead of silently truncating", () => {
    expect(() => localDateInManila("not-a-date")).toThrow(RangeError);
  });
});
