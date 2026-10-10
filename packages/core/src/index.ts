export const METHOD_VERSION = "monthly-gas-cost/0.1.0";
export interface Procurement {
  quantityMMBtu: number;
  fixedShare: number;
  fixedPriceUSDPerMMBtu: number;
  floatingPriceUSDPerMMBtu: number;
}
export interface ComparisonInput { baseline: Procurement; scenario: Procurement }
const fields = ["quantityMMBtu", "fixedShare", "fixedPriceUSDPerMMBtu", "floatingPriceUSDPerMMBtu"] as const;
export function validateProcurement(value: unknown): Procurement {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a procurement object");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !fields.includes(key as typeof fields[number]))) throw new Error("Unknown procurement field");
  for (const key of fields) {
    if (typeof data[key] !== "number" || !Number.isFinite(data[key]) || data[key] < 0) throw new Error(`${key} must be a finite non-negative number`);
  }
  if ((data.fixedShare as number) > 1) throw new Error("fixedShare must be between 0 and 1");
  return Object.fromEntries(fields.map(key => [key, data[key]])) as unknown as Procurement;
}
export function monthlyCost(value: unknown): number {
  const p = validateProcurement(value);
  const cost = p.quantityMMBtu * (p.fixedShare * p.fixedPriceUSDPerMMBtu + (1 - p.fixedShare) * p.floatingPriceUSDPerMMBtu);
  if (!Number.isFinite(cost)) throw new Error("Calculated cost exceeds supported numeric range");
  return cost;
}
export function compare(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected baseline and scenario");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== "baseline" && key !== "scenario")) throw new Error("Unknown comparison field");
  const baseline = validateProcurement(input.baseline);
  const scenario = validateProcurement(input.scenario);
  const baselineCostUSD = monthlyCost(baseline);
  const scenarioCostUSD = monthlyCost(scenario);
  return { methodVersion: METHOD_VERSION, currency: "USD", quantityUnit: "MMBtu", period: "one month", inputs: { baseline, scenario }, baselineCostUSD, scenarioCostUSD, changeUSD: scenarioCostUSD - baselineCostUSD };
}
// Synthetic assumptions; not market data or a forecast.
export const DEMO: ComparisonInput = {
  baseline: { quantityMMBtu: 10000, fixedShare: 0.4, fixedPriceUSDPerMMBtu: 10, floatingPriceUSDPerMMBtu: 12 },
  scenario: { quantityMMBtu: 10000, fixedShare: 0.4, fixedPriceUSDPerMMBtu: 10, floatingPriceUSDPerMMBtu: 15 },
};

export type DataSource = "synthetic-demo" | "user-adjusted" | "user-provided";
export type Envelope = ReturnType<typeof compare> & { dataSource: DataSource };
export function envelope(input: unknown, dataSource: DataSource): Envelope {
  return { dataSource, ...compare(input) };
}
export function decodeInput(value: unknown): ComparisonInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  const data = value as Record<string, unknown>;
  if (!("inputs" in data)) return compare(data).inputs;
  const keys = ["dataSource", "methodVersion", "currency", "quantityUnit", "period", "inputs", "baselineCostUSD", "scenarioCostUSD", "changeUSD"];
  if (Object.keys(data).length !== keys.length || Object.keys(data).some(k => !keys.includes(k))) throw new Error("Invalid envelope fields");
  if (data.methodVersion !== METHOD_VERSION || data.currency !== "USD" || data.quantityUnit !== "MMBtu" || data.period !== "one month") throw new Error("Unsupported method, unit or period");
  if (!["synthetic-demo", "user-adjusted", "user-provided"].includes(data.dataSource as string)) throw new Error("Unsupported data source");
  for (const key of ["baselineCostUSD", "scenarioCostUSD", "changeUSD"]) if (typeof data[key] !== "number" || !Number.isFinite(data[key])) throw new Error(`Invalid ${key}`);
  return compare(data.inputs).inputs;
}
export function parseDecimal(text: string): number {
  const value = text.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new Error("Enter a decimal number");
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Enter a finite non-negative number");
  return number;
}
