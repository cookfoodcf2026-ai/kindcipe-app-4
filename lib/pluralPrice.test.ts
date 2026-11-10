import { perMonthFromYearly, yearlySavePct } from "./pluralPrice";

describe("perMonthFromYearly", () => {
  it("keeps the US$ prefix", () => {
    expect(perMonthFromYearly("US$49.99")).toBe("US$4.16");
  });

  it("keeps the HK$ prefix", () => {
    expect(perMonthFromYearly("HK$388.00")).toBe("HK$32.33");
  });

  it("keeps a bare $ prefix", () => {
    expect(perMonthFromYearly("$49.99")).toBe("$4.16");
  });

  it("returns null for garbage", () => {
    expect(perMonthFromYearly("garbage")).toBeNull();
  });

  it("handles a decimal comma and a trailing currency symbol", () => {
    expect(perMonthFromYearly("49,99 €")).toBe("€4.16");
  });
});

describe("yearlySavePct", () => {
  it("rounds (4.99, 49.99) to 17", () => {
    expect(yearlySavePct("$4.99", "$49.99")).toBe(17);
  });

  it("computes the regular HK$ anchors as 15", () => {
    expect(yearlySavePct("HK$38.00", "HK$388.00")).toBe(15);
  });

  it("returns null when either price cannot be parsed", () => {
    expect(yearlySavePct("garbage", "$49.99")).toBeNull();
    expect(yearlySavePct("$4.99", "garbage")).toBeNull();
  });

  it("returns null when the currencies differ", () => {
    expect(yearlySavePct("HK$38.00", "US$49.99")).toBeNull();
  });
});
