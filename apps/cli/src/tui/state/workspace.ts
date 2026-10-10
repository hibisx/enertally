import { compare, decodeInput, DEMO, envelope, parseDecimal, type ComparisonInput, type DataSource, type Envelope } from "@enertally/core";
export const sides = ["baseline", "scenario"] as const;
export const fields = ["quantityMMBtu", "fixedShare", "fixedPriceUSDPerMMBtu", "floatingPriceUSDPerMMBtu"] as const;
export const labels = ["Quantity MMBtu", "Fixed share 0-1", "Fixed price USD/MMBtu", "Floating price USD/MMBtu"];
export class Workspace {
  draft: string[] = [];
  revision = 0;
  resultRevision = -1;
  exportedRevision = -1;
  source: DataSource = "synthetic-demo";
  result?: Envelope;
  get dirty() { return this.draft.length > 0 && this.exportedRevision !== this.revision; }
  get valid() { return !!this.result && this.resultRevision === this.revision; }
  load(value: unknown, source: DataSource = "user-provided") {
    const input = decodeInput(value);
    const draft = sides.flatMap(side => fields.map(field => String(input[side][field])));
    this.draft = draft; this.source = source; this.revision++; this.result = undefined;
  }
  demo() { this.load(DEMO, "synthetic-demo"); }
  edit(index: number, value: string) {
    if (this.draft[index] === value) return;
    this.draft[index] = value; this.revision++; this.source = "user-adjusted"; this.result = undefined;
  }
  calculate() {
    const input = {} as ComparisonInput;
    sides.forEach((side, s) => {
      input[side] = Object.fromEntries(fields.map((field, f) => {
        try { const value = parseDecimal(this.draft[s * 4 + f] ?? ""); if (field === "fixedShare" && value > 1) throw new Error("Must be between 0 and 1"); return [field, value]; }
        catch (error) { throw new Error(`${side}.${field}: ${(error as Error).message}`); }
      })) as unknown as ComparisonInput[typeof side];
    });
    this.result = envelope(compare(input).inputs, this.source); this.resultRevision = this.revision;
    return this.result;
  }
  snapshot() { if (!this.valid) throw new Error("Compare current inputs before exporting"); return structuredClone(this.result!); }
}
