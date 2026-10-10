import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile, symlink, mkdir } from "node:fs/promises";
import { DEMO, envelope, decodeInput, parseDecimal } from "@enertally/core";
import { readInput, writeResult, MAX_BYTES } from "./io/json-files";
import { Workspace } from "./tui/state/workspace";
import { resolve } from "node:path";
const entry = resolve(import.meta.dir, "index.ts");
function cli(...args: string[]) { return Bun.spawnSync([process.execPath, entry, ...args]); }
test("strict envelope metadata and recomputation", () => {
  const output = envelope(DEMO, "synthetic-demo");
  expect(envelope(decodeInput({ ...output, changeUSD: 999 }), "user-provided").changeUSD).toBe(18000);
  for (const patch of [{ currency: "EUR" }, { period: "year" }, { methodVersion: "future" }, { quantityUnit: "kWh" }, { dataSource: "market" }, { extra: 1 }, { changeUSD: null }]) expect(() => decodeInput({ ...output, ...patch })).toThrow();
  const { period, ...missing } = output; expect(() => decodeInput(missing)).toThrow();
});
test("decimal drafts and revision invalidation", () => {
  for (const text of ["", "  ", "0x10", "1,000", "2 MMBtu", "NaN", "Infinity", "-1"]) expect(() => parseDecimal(text)).toThrow();
  expect(parseDecimal(" 1e3 ")).toBe(1000);
  const w = new Workspace(); w.demo(); expect(w.calculate().changeUSD).toBe(18000);
  w.edit(7, "16"); expect(w.valid).toBe(false); expect(() => w.snapshot()).toThrow();
  expect(w.calculate().changeUSD).toBe(24000);
  const before = [...w.draft]; expect(() => w.load({ baseline: {} })).toThrow(); expect(w.draft).toEqual(before);
  w.edit(0, ""); expect(() => w.calculate()).toThrow("baseline.quantityMMBtu");
});
test("real files, limits, symlinks, no overwrite and CLI roundtrip", async () => {
  const dir = await mkdtemp("/private/tmp/enertally-test-");
  try {
    const out = `${dir}/result.json`; await writeResult(out, envelope(DEMO, "synthetic-demo"));
    expect(await readInput(out)).toEqual(DEMO);
    const run = cli("compare", out); expect(run.exitCode).toBe(0); expect(JSON.parse(run.stdout.toString()).changeUSD).toBe(18000);
    expect(JSON.parse(cli(out).stdout.toString()).dataSource).toBe("user-provided");
    await expect(writeResult(out, envelope(DEMO, "user-provided"))).rejects.toThrow();
    await writeFile(`${dir}/raw.json`, JSON.stringify(DEMO)); expect(await readInput(`${dir}/raw.json`)).toEqual(DEMO);
    await writeFile(`${dir}/bad.json`, "{"); await expect(readInput(`${dir}/bad.json`)).rejects.toThrow();
    await writeFile(`${dir}/limit.json`, JSON.stringify(DEMO).padEnd(MAX_BYTES)); expect(await readInput(`${dir}/limit.json`)).toEqual(DEMO);
    await writeFile(`${dir}/limit.json`, " ".repeat(MAX_BYTES + 1)); await expect(readInput(`${dir}/limit.json`)).rejects.toThrow("1 MiB");
    await expect(readInput(dir)).rejects.toThrow();
    await symlink(out, `${dir}/link`); await expect(readInput(`${dir}/link`)).rejects.toThrow();
    await mkdir(`${dir}/folder`); await symlink(`${dir}/folder`, `${dir}/parent`); await expect(writeResult(`${dir}/parent/new.json`, envelope(DEMO, "synthetic-demo"))).rejects.toThrow();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("CLI mode boundaries and exit codes", () => {
  expect(cli().exitCode).toBe(0); expect(cli("--help").exitCode).toBe(0);
  expect(JSON.parse(cli("--demo").stdout.toString()).baselineCostUSD).toBe(112000);
  for (const args of [["compare"], ["compare", "-"], ["--unknown"], ["--demo", "extra"], ["tui"]]) { const run = cli(...args); expect(run.exitCode).toBe(1); expect(run.stdout.length).toBe(0); expect(run.stderr.toString()).not.toContain("\x1b"); }
});
