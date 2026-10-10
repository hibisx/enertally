import { mkdir, chmod, rm } from "node:fs/promises";
await rm("apps/cli/dist", { recursive: true, force: true });
await mkdir("apps/cli/dist", { recursive: true });
const build = await Bun.build({ entrypoints: ["apps/cli/src/index.ts"], outdir: "apps/cli/dist", target: "bun", splitting: true, packages: "external" });
if (!build.success) throw new AggregateError(build.logs, "CLI build failed");
await chmod("apps/cli/dist/index.js", 0o755);
console.log("Built CLI (requires workspace dependencies; not a standalone distribution)");
