import { summarizeShoppingBatch } from "./shoppingBatch";

describe("summarizeShoppingBatch", () => {
  it("counts only ok and not skipped items", () => {
    const summary = summarizeShoppingBatch(
      {
        success: true,
        count: 2,
        merged: 0,
        items: [
          { index: 0, ok: true, skipped: false },
          { index: 1, ok: false, skipped: true, reason: "invalid_ref" },
          { index: 2, ok: true, skipped: false },
        ],
      },
      3
    );
    expect(summary).toEqual({
      added: 2,
      skipped: 1,
      total: 3,
      allSkipped: false,
      partial: true,
    });
  });

  it("flags all-skipped batches", () => {
    const summary = summarizeShoppingBatch(
      {
        success: true,
        count: 0,
        items: [
          { ok: false, skipped: true, reason: "invalid_ref" },
          { ok: false, skipped: true, reason: "invalid_ref" },
        ],
      },
      2
    );
    expect(summary.added).toBe(0);
    expect(summary.skipped).toBe(2);
    expect(summary.allSkipped).toBe(true);
    expect(summary.partial).toBe(false);
  });

  it("treats a missing item breakdown as full success via count", () => {
    expect(summarizeShoppingBatch({ success: true, count: 4 }, 4)).toEqual({
      added: 4,
      skipped: 0,
      total: 4,
      allSkipped: false,
      partial: false,
    });
  });

  it("falls back to requested count for legacy array responses", () => {
    const summary = summarizeShoppingBatch([{ id: "1" }, { id: "2" }], 2);
    expect(summary.added).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.allSkipped).toBe(false);
  });
});
