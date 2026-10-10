import { mkdtemp, mkdir, copyFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const output = await mkdtemp("/private/tmp/enertally-candidate-");
async function copy(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (["node_modules", "dist"].includes(entry.name) || entry.name.startsWith(".")) continue;
    const from = join(source, entry.name), to = join(destination, entry.name);
    if (entry.isDirectory()) await copy(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}
for (const directory of ["apps", "packages", "scripts"]) await copy(directory, join(output, directory));
for (const file of ["package.json", "tsconfig.json", "bun.lock"]) await copyFile(file, join(output, file));
await writeFile(join(output, "CANDIDATE.txt"), "EnerTally 0.0.0 local candidate, 2026-10-10. Private; license undecided. Not authorized for distribution. Requires Bun 1.3.14 and locked dependencies. No internal docs/research included.\n");
console.log(output);
