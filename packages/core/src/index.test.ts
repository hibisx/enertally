import { describe, expect, test } from "bun:test";
import { compare, DEMO, monthlyCost, validateProcurement } from "./index";
describe("monthly physical gas procurement", () => {
  test("hand calculation: baseline 112000, stress 130000, increase 18000", () => {
    const result = compare(DEMO);
    expect(result.baselineCostUSD).toBe(112000);
    expect(result.scenarioCostUSD).toBe(130000);
    expect(result.changeUSD).toBe(18000);
  });
  test("fully fixed ignores floating price; fully floating ignores fixed price", () => {
    expect(monthlyCost({ ...DEMO.baseline, fixedShare: 1, floatingPriceUSDPerMMBtu: 999 })).toBe(100000);
    expect(monthlyCost({ ...DEMO.baseline, fixedShare: 0, fixedPriceUSDPerMMBtu: 999 })).toBe(120000);
  });
  test("zero quantity, zero prices and unchanged scenario", () => {
    expect(monthlyCost({ ...DEMO.baseline, quantityMMBtu: 0 })).toBe(0);
    expect(monthlyCost({ ...DEMO.baseline, fixedPriceUSDPerMMBtu: 0, floatingPriceUSDPerMMBtu: 0 })).toBe(0);
    expect(compare({ baseline: DEMO.baseline, scenario: DEMO.baseline }).changeUSD).toBe(0);
  });
  test("price decrease is a negative cost change", () => {
    expect(compare({ baseline: DEMO.scenario, scenario: DEMO.baseline }).changeUSD).toBe(-18000);
  });
  test("fractional quantities and shares retain precision", () => {
    expect(monthlyCost({ quantityMMBtu: 2.5, fixedShare: 0.25, fixedPriceUSDPerMMBtu: 8, floatingPriceUSDPerMMBtu: 12 })).toBeCloseTo(27.5, 10);
  });
  test("reject invalid shares, missing fields, coercion, non-finite and negative inputs", () => {
    for (const field of Object.keys(DEMO.baseline)) for (const value of [-1, NaN, Infinity, "12", null, undefined]) {
      expect(() => validateProcurement({ ...DEMO.baseline, [field]: value })).toThrow();
    }
    expect(() => validateProcurement({ ...DEMO.baseline, fixedShare: 1.01 })).toThrow();
    expect(() => compare({ ...DEMO, currency: "SGD" })).toThrow();
    expect(() => monthlyCost({ ...DEMO.baseline, currency: "SGD" })).toThrow();
    expect(() => compare(null)).toThrow();
  });
  test("reject numeric overflow", () => {
    expect(() => monthlyCost({ ...DEMO.baseline, quantityMMBtu: Number.MAX_VALUE })).toThrow();
  });
  test("repeatable result, copied inputs and no mutation", () => {
    const input = structuredClone(DEMO);
    const result = compare(input);
    expect(compare(result.inputs)).toEqual(result);
    input.baseline.quantityMMBtu = 5;
    expect(result.inputs.baseline.quantityMMBtu).toBe(10000);
    expect(DEMO.baseline.quantityMMBtu).toBe(10000);
  });
});
