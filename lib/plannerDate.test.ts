import { resolvePlannerBuyDate } from "./shoppingDate";

describe("planner buy-date resolver", () => {
  const today = "2026-11-10";

  it("returns today for today's dinner", () => {
    expect(resolvePlannerBuyDate(today, today)).toBe(today);
  });

  it("returns the day before for a future dinner", () => {
    expect(resolvePlannerBuyDate("2026-11-11", today)).toBe("2026-11-10");
    expect(resolvePlannerBuyDate("2026-11-17", today)).toBe("2026-11-16");
  });

  it("falls back to today for a past dinner instead of drifting further back", () => {
    expect(resolvePlannerBuyDate("2026-11-09", today)).toBe(today);
  });

  it("returns today when there is no meal date", () => {
    expect(resolvePlannerBuyDate(null, today)).toBe(today);
  });
});
