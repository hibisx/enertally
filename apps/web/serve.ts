import "../../scripts/build";
import { docRoutes } from "./content/docs/pages";
const routes: Record<string, string> = { ...docRoutes, "/docs.js": "docs.js", "/samples/monthly-gas.json": "samples/monthly-gas.json", "/": "index.html", "/index.html": "index.html", "/main.js": "main.js", "/style.css": "style.css" };
const server = Bun.serve({
  hostname: "127.0.0.1", port: Number(process.env.PORT ?? 3000),
  fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const file = routes[new URL(request.url).pathname];
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(Bun.file(new URL(`./dist/${file}`, import.meta.url)), { headers: { "Content-Security-Policy": "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" } });
  },
});
console.log(`EnerTally local demo: ${server.url} (restart after source edits)`);
