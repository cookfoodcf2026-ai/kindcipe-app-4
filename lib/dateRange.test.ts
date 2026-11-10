import { buildDateRange, clampDateToRange } from "./dateRange";

describe("PlanDatePicker date range", () => {
  const today = "2026-11-10";

  it("buildDateRange never returns a date beyond maxDate", () => {
    const range = buildDateRange(today, "2026-11-18");

    expect(range[0]).toBe(today);
    expect(range[range.length - 1]).toBe("2026-11-18");
    expect(range).toHaveLength(9);
    expect(range.some((date) => date > "2026-11-18")).toBe(false);
  });

  it("limits today's meal to exactly today when maxDate is today", () => {
    expect(buildDateRange(today, today)).toEqual([today]);
  });

  it("still generates a capped window when maxDate is absent", () => {
    expect(buildDateRange(today, null, 3)).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
  });

  it("clamps a value outside the range into it", () => {
    expect(clampDateToRange("2026-11-19", today, "2026-11-18")).toBe(
      "2026-11-18",
    );
    expect(clampDateToRange("2026-11-01", today, "2026-11-18")).toBe(today);
    expect(clampDateToRange("2026-11-15", today, "2026-11-18")).toBe(
      "2026-11-15",
    );
  });
});
