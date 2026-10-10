import { mkdir, copyFile, mkdtemp, rm, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pages, sample } from "../apps/web/content/docs/pages";
import { verifyPublic } from "./verify-public";
import { renderPage } from "../apps/web/content/docs/render";
const parent = resolve("apps/web");
const output = await mkdtemp(`${parent}/.dist-build-`);
try {
  const result = await Bun.build({ entrypoints: ["apps/web/src/main.ts", "apps/web/src/docs.ts"], outdir: output, target: "browser", minify: true, naming: "[name].js" });
  if (!result.success) throw new AggregateError(result.logs, "Web build failed");
  for (const file of ["index.html", "style.css"]) await copyFile(`${parent}/${file}`, `${output}/${file}`);
  for (const page of pages) {
    const file = `${output}/docs/${page.slug ? page.slug + "/" : ""}index.html`;
    await mkdir(dirname(file), { recursive: true }); await writeFile(file, renderPage(page));
  }
  await mkdir(`${output}/samples`); await writeFile(`${output}/samples/monthly-gas.json`, sample);
  await verifyPublic(output);
  await rm(`${parent}/dist`, { recursive: true, force: true });
  await rename(output, `${parent}/dist`);
} finally { await rm(output, { recursive: true, force: true }); }
console.log("Built explicit public Web + documentation assets");
