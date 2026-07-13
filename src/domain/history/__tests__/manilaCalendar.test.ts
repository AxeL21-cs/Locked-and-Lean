import {
  addLocalDateDays,
  buildMonthGrid,
  buildWeek,
  localDateInManila,
  manilaDayBoundsUtc,
  monthBounds,
  monthLabel,
  parseLocalDate,
  weekBounds,
  zonedDayBoundsUtc,
} from "..";

describe("Asia/Manila local date boundaries", () => {
  it("moves UTC instants across Manila midnight and month boundaries", () => {
    expect(localDateInManila("2026-07-31T15:59:59.999Z")).toBe("2026-07-31");
    expect(localDateInManila("2026-07-31T16:00:00.000Z")).toBe("2026-08-01");
    expect(localDateInManila("2026-12-31T16:00:00.000Z")).toBe("2027-01-01");
  });

  it("returns exact UTC bounds for a Manila calendar day", () => {
    expect(manilaDayBoundsUtc("2026-07-13")).toEqual({
      startInclusive: "2026-07-12T16:00:00.000Z",
      endExclusive: "2026-07-13T16:00:00.000Z",
      durationHours: 24,
    });
  });

  it("uses IANA transitions rather than assuming every timezone day has 24 hours", () => {
    expect(zonedDayBoundsUtc("2026-03-08", "America/New_York")).toMatchObject({
      startInclusive: "2026-03-08T05:00:00.000Z",
      endExclusive: "2026-03-09T04:00:00.000Z",
      durationHours: 23,
    });
    expect(zonedDayBoundsUtc("2026-11-01", "America/New_York")).toMatchObject({
      durationHours: 25,
    });
  });

  it("performs local-date arithmetic independently of device timezone or DST", () => {
    expect(addLocalDateDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addLocalDateDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addLocalDateDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(() => parseLocalDate("2026-02-29")).toThrow(
      "Local date is not a real calendar date.",
    );
  });
});

describe("month, week, and day contracts", () => {
  it("builds a stable six-week Monday-first July 2026 grid", () => {
    const grid = buildMonthGrid({
      year: 2026,
      month: 7,
      today: "2026-07-13",
    });

    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({
      localDate: "2026-06-29",
      weekdayLabel: "Mon",
      inDisplayedMonth: false,
    });
    expect(grid.at(-1)).toMatchObject({
      localDate: "2026-08-09",
      weekdayLabel: "Sun",
      inDisplayedMonth: false,
    });
    expect(grid.find(({ isToday }) => isToday)).toMatchObject({
      localDate: "2026-07-13",
      accessibilityLabel: "Monday, July 13, 2026",
    });
    expect(
      grid.filter(({ inDisplayedMonth }) => inDisplayedMonth),
    ).toHaveLength(31);
  });

  it("uses Monday-to-Sunday week bounds across a month boundary", () => {
    expect(weekBounds("2026-08-01")).toEqual({
      start: "2026-07-27",
      end: "2026-08-02",
    });
    expect(
      buildWeek({ localDate: "2026-08-01", today: "2026-08-01" }).map(
        ({ localDate }) => localDate,
      ),
    ).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("returns correct leap-month bounds and human label", () => {
    expect(monthBounds(2028, 2)).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
    expect(monthLabel(2028, 2)).toBe("February 2028");
  });
});
