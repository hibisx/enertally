import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pages, docRoutes } from "../apps/web/content/docs/pages";
import { decodeInput, envelope } from "../packages/core/src/index";

const allowed = new Set(["index.html", "main.js", "docs.js", "style.css", "samples/monthly-gas.json", ...Object.values(docRoutes)]);
async function scan(dir: string, prefix = "") {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + item.name;
    if (item.isDirectory()) await scan(join(dir, item.name), path + "/");
    else {
      if (!allowed.has(path)) throw new Error(`Unexpected public artifact: ${path}`);
      const text = await readFile(join(dir, item.name), "utf8");
      if (/\/Users\/|HANDOFF|research\/|x-drafts|AGENTS\.md|sk-proj-/.test(text)) throw new Error(`Internal content detected: ${path}`);
      if (path.endsWith(".html")) for (const match of text.matchAll(/(?:href|src)="([^"#]+)"/g)) {
        const url = match[1]!;
        if (!url.startsWith("/")) throw new Error(`Unexpected external link: ${url}`);
        const route = url.split("#")[0]!;
        if (route !== "/" && !(route in docRoutes) && !allowed.has(route.slice(1))) throw new Error(`Broken link: ${route}`);
      }
    }
  }
}
export async function verifyPublic(root: string) {
await scan(root);
for (const page of pages) await readFile(`${root}/docs/${page.slug ? page.slug + "/" : ""}index.html`);
const input = decodeInput(JSON.parse(await readFile(`${root}/samples/monthly-gas.json`, "utf8")));
if (envelope(input, "synthetic-demo").changeUSD !== 18000) throw new Error("Sample mismatch");
console.log("Public artifact allowlist, links and sample verified");
}
if (import.meta.main) await verifyPublic("apps/web/dist");
