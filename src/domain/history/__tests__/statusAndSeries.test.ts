import {
  buildDailyMacroSeries,
  buildSparseWeightSeries,
  calendarStatusLegend,
  describeCalendarStatus,
  summarizeNutritionWeek,
} from "..";

describe("non-color-only calendar status", () => {
  it("defines text, symbol, and screen-reader meaning for every required status", () => {
    const legend = calendarStatusLegend();
    expect(legend.map(({ status }) => status)).toEqual([
      "within_target",
      "below_target",
      "above_target",
      "incomplete",
      "no_records",
    ]);
    for (const item of legend) {
      expect(item.label).toBeTruthy();
      expect(item.symbol).toBeTruthy();
      expect(item.accessibilityLabel).toContain(item.label.split(" ")[0]);
      expect(item.colorToken).toBeTruthy();
    }
    expect(new Set(legend.map(({ symbol }) => symbol)).size).toBe(
      legend.length,
    );
  });

  it("does not use moralizing food language", () => {
    const copy = JSON.stringify(calendarStatusLegend());
    expect(copy).not.toMatch(/good|bad|clean|dirty|cheat|failure/i);
    expect(describeCalendarStatus("incomplete").label).toBe("Incomplete");
  });
});

describe("missing nutrition and weekly summaries", () => {
  it("preserves missing macros instead of converting them to zero", () => {
    const series = buildDailyMacroSeries(
      { start: "2026-07-13", end: "2026-07-15" },
      [
        {
          localDate: "2026-07-13",
          entryCount: 1,
          proteinG: 30,
          carbohydratesG: null,
          fatG: 10,
        },
        {
          localDate: "2026-07-14",
          entryCount: 1,
          proteinG: 40,
          carbohydratesG: 50,
          fatG: 15,
        },
      ],
    );

    expect(series[0]).toMatchObject({
      completeness: "partial",
      carbohydratesG: null,
      missingMacros: ["carbohydrates"],
      markerShape: "triangle",
      visibleLabel: "Incomplete",
    });
    expect(series[1]).toMatchObject({ completeness: "complete" });
    expect(series[2]).toMatchObject({
      completeness: "missing",
      proteinG: null,
      carbohydratesG: null,
      fatG: null,
      markerShape: "gap",
      visibleLabel: "No records",
    });
  });

  it("reports weekly calories while keeping incomplete weekly macros null", () => {
    const summary = summarizeNutritionWeek(
      { start: "2026-07-13", end: "2026-07-19" },
      [
        {
          localDate: "2026-07-13",
          entryCount: 1,
          calories: 500,
          proteinG: 30,
          carbohydratesG: 60,
          fatG: 12,
          macroDataComplete: true,
        },
        {
          localDate: "2026-07-15",
          entryCount: 1,
          calories: 400,
          proteinG: null,
          carbohydratesG: null,
          fatG: null,
          macroDataComplete: false,
        },
      ],
    );

    expect(summary).toMatchObject({
      recordedDays: 2,
      calories: 900,
      proteinG: null,
      carbohydratesG: null,
      fatG: null,
      macroDataComplete: false,
    });
    expect(summary.missingRecordDays).toHaveLength(5);
    expect(summary.accessibilityLabel).toContain("macros incomplete");
  });
});

describe("sparse weight series", () => {
  it("leaves missing dates empty and computes trends only on recorded observations", () => {
    const series = buildSparseWeightSeries({
      range: { start: "2026-07-13", end: "2026-07-17" },
      observations: [
        {
          id: "w1",
          localDate: "2026-07-13",
          measuredAt: "2026-07-13T00:00:00.000Z",
          weightKg: 70,
        },
        {
          id: "w2-early",
          localDate: "2026-07-15",
          measuredAt: "2026-07-15T00:00:00.000Z",
          weightKg: 69.8,
        },
        {
          id: "w2-latest",
          localDate: "2026-07-15",
          measuredAt: "2026-07-15T12:00:00.000Z",
          weightKg: 69.6,
        },
        {
          id: "w3",
          localDate: "2026-07-17",
          measuredAt: "2026-07-17T00:00:00.000Z",
          weightKg: 69.4,
        },
      ],
      rollingWindow: 3,
    });

    expect(series.map(({ weightKg }) => weightKg)).toEqual([
      70,
      null,
      69.6,
      null,
      69.4,
    ]);
    expect(series[1]).toMatchObject({
      marker: "missing",
      markerShape: "gap",
      visibleLabel: "No weight",
      rollingAverageKg: null,
      accessibilityLabel: "2026-07-14: no weight recorded",
    });
    expect(series[2]).toMatchObject({
      observationId: "w2-latest",
      gapDaysSincePrevious: 2,
      rollingAverageKg: 69.8,
      markerShape: "circle",
      visibleLabel: "69.6 kg",
    });
    expect(series[4]).toMatchObject({
      gapDaysSincePrevious: 2,
      rollingAverageKg: 69.67,
    });
  });

  it("rejects a weight point filed under the wrong Manila date", () => {
    expect(() =>
      buildSparseWeightSeries({
        range: { start: "2026-07-13", end: "2026-07-13" },
        observations: [
          {
            id: "wrong-date",
            localDate: "2026-07-13",
            measuredAt: "2026-07-12T15:59:59.999Z",
            weightKg: 70,
          },
        ],
      }),
    ).toThrow(
      "Weight observation local date does not match its Asia/Manila instant.",
    );
  });
});
