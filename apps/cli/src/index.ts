#!/usr/bin/env bun
import { envelope, DEMO } from "@enertally/core";
import { readInput, safeText } from "./io/json-files";
const args = process.argv.slice(2);
const help = "EnerTally — monthly natural gas, USD/MMBtu\nUsage: enertally compare <input.json> | tui | --demo | --help\nLegacy: enertally <input.json>. Demo is synthetic. JSON input only; no stdin/CSV.";
try {
  if (!args.length || (args.length === 1 && args[0] === "--help")) console.log(help);
  else if (args.length === 1 && args[0] === "--demo") console.log(JSON.stringify(envelope(DEMO, "synthetic-demo"), null, 2));
  else if (args.length === 1 && args[0] === "tui") {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("TUI requires a terminal. Use compare <input.json> for scripts.");
    const { start } = await import("./tui/renderer");
    await start();
  } else {
    const path = args.length === 2 && args[0] === "compare" ? args[1] : args.length === 1 && !args[0]!.startsWith("-") && args[0] !== "compare" ? args[0] : undefined;
    if (!path || path === "-") throw new Error(help);
    console.log(JSON.stringify(envelope(await readInput(path), "user-provided"), null, 2));
  }
} catch (error) {
  console.error(safeText(error instanceof Error ? error.message : "Invalid input"));
  process.exitCode = 1;
}
