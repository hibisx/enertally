# EnerTally

See how energy prices affect your costs.

EnerTally compares one month of natural gas procurement costs with transparent, reproducible calculations. It includes a browser calculator, same-site documentation, a JSON CLI and an OpenTUI terminal workspace. Demo assumptions are synthetic; no live market data, account or LLM is required.

## Run locally

Requires Bun 1.3.14. From the repository root:

```sh
bun install --frozen-lockfile
bun run check
bun run dev
```

Open http://127.0.0.1:3000 for the calculator and `/docs` for user documentation. Restart the server after source edits. Use `PORT=3001 bun run dev` to change the local port.

```sh
bun run cli --demo
bun run cli compare input.json
bun run cli --help
bun run cli tui
bun run build:cli
bun apps/cli/dist/index.js compare input.json
```

`compare` accepts raw baseline/scenario inputs or a complete EnerTally JSON export and recalculates from the inputs. No arguments prints help and exits 0. Comparisons write JSON to stdout; errors go to stderr and exit 1. `tui` requires an interactive terminal.

The terminal workspace supports `/demo`, `/edit baseline`, `/edit scenario`, `/compare`, `/import`, `/export`, `/method`, `/status`, `/help` and `/quit`. Ctrl+K opens the command menu. Editing invalidates the previous result. Imports are limited to regular UTF-8 JSON files up to 1 MiB; symlink paths are rejected. Exports create new files without overwriting existing files.

## Workspace

This is a Bun monorepo with one root lockfile:

| Workspace | Purpose |
| --- | --- |
| `packages/core` | Pure TypeScript validation, calculation and file schema |
| `apps/web` | Browser calculator and explicitly maintained public documentation |
| `apps/cli` | Script commands and dynamically loaded OpenTUI workspace |
| `apps/mcp` | Placeholder; MCP protocol is not implemented |

`bun run build` generates Web assets in `apps/web/dist` and CLI chunks in `apps/cli/dist`. The CLI build requires workspace dependencies and is not a standalone executable. No registry package or binary download is currently provided.

## Calculation and limits

Cost = quantity × [fixed share × fixed price + (1 − fixed share) × floating price].

Quantity is MMBtu, prices are USD/MMBtu, and costs are USD for one month. Fixed share is a fraction from 0 to 1; all inputs must be finite and non-negative. Change is scenario cost minus baseline cost. The synthetic example returns $112,000 baseline, $130,000 scenario and +$18,000 change.

Method version: `monthly-gas-cost/0.1.0`. Calculations use JavaScript floating-point arithmetic without intermediate rounding. Displays show cents; JSON exports retain calculation precision. Fixed-price physical procurement is not derivatives hedging. Scenarios are assumptions, not forecasts or probabilities.

Multiple months, CSV, FX, taxes, transport costs, basis, options, full LNG valuation, accounts and billing are not implemented. Calculations run locally in the browser or CLI; the application does not upload inputs or enable analytics. Hosting providers may retain static asset access logs.

## Verification

```sh
bun run check
python3 scripts/verify-pty.py
```

The check covers TS/TSX, core and CLI behavior, both builds, public artifact allowlists, documentation links and the synthetic sample. PTY tests cover editing, menus, comparison, import/export, no overwrite, resize and terminal restoration.

Bun 1.3.14 with OpenTUI core/react 0.5.17 and React 19.3.0 has been exercised on macOS arm64. Graphical terminal, physical phone and other platform acceptance remain pending. File checks protect the leaf and reject existing symlink components; concurrent parent-directory replacement remains a limitation.

## Project status

Early local prototype, product version 0.0.0. Hosted deployment and external user validation are pending. Source visibility does not imply a hosted service or package release.

The project license is undecided; no open-source license has been granted yet. All workspace packages remain `private: true` to prevent accidental registry publication.
