# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `yarn dev` — Vite dev server + Electron in parallel (renderer at `tcp:5173`, Electron waits on it).
- `yarn build` — Builds the SvelteKit app (adapter-node) into `build/`. Electron in prod loads this via `fork`.
- `yarn start` — Run Electron against the already-built `build/index.js`.
- `yarn test` — `vitest run`. Run a single test with `yarn vitest run path/to/file.test.js` (or `-t "name"` to filter). `*.svelte.test.js` files auto-run in jsdom (see `vite.config.js`).
- `yarn lint` — `eslint .`
- `yarn dist-mac` / `dist-win` / `dist-linux` / `dist` — electron-builder packaging. `release*` variants publish to GitHub on tag/draft.

## Architecture

Elastron is a hybrid **Electron + SvelteKit (adapter-node)** desktop app. Understanding how the two processes connect is essential — it is not a typical Electron app.

### Process model

1. **Electron main** (`main.js`) boots and calls `startServer()`:
   - In dev (`npm_lifecycle_event === 'dev'`), it assumes Vite is serving on port 5173.
   - In prod, it `fork()`s `build/index.js` (the adapter-node server) on a free port discovered via `get-port`, then polls `http://localhost:<port>` until it responds.
   - `BrowserWindow` then `loadURL`s that local HTTP server. There is no `file://` loading — the renderer is always a real HTTP client talking to a local Node server.
2. **Preload** (`preload.js`) exposes a narrow `window.electron.ipcRenderer` surface via `contextBridge` with explicit channel allowlists (`header-doubleclick`, `check-for-updates`, `window:new`, `update_available`, `update_downloaded`) plus a `store` wrapper for persisted settings.
3. **SvelteKit server routes** under `src/routes/api/elastic/**` are the backend-for-frontend. They own the Elasticsearch client and talk to the cluster; the renderer only `fetch`es SvelteKit endpoints. This means adding a new ES operation = adding a `+server.js` under `src/routes/api/elastic/`, not an IPC handler.

IPC is intentionally minimal (window management, persisted store, updates). Do not add Elasticsearch logic to `main.js` — put it in SvelteKit API routes.

### Elasticsearch client

- Both ES 8 and 9 are bundled as aliased packages in `package.json`: `elasticsearch8` and `elasticsearch9`.
- `src/lib/server/elastic.js` → `createClient(connection)` picks the client based on `connection.version` (`'9...'` → Client9, else Client8). Always go through this factory; do not import ES clients directly in routes.
- SSH tunneling: `src/lib/server/tunnel.js` (`tunnelManager`) sets up `ssh2` tunnels for connections that need them; `createClient` integrates with it.

### State (Storeon)

- All store modules live in `src/lib/store/` and are composed in `src/lib/store/index.js` (`createStoreon([...])`). ES-specific modules are under `src/lib/store/elasticsearch/`.
- In components: `const { data } = useStoreon('moduleName')` to read; `dispatch('module/action', payload)` to write.
- Adding a new feature generally means: new store module → register it in `store/index.js` → new `+server.js` route → component in `src/routes/<feature>` or `src/lib/workspace/<feature>`.

### Routes / UI layout

- `src/routes/{dashboard,index,monitoring,playground,search}` are the top-level workspace pages. Each has a matching component tree under `src/lib/workspace/<name>/`.
- `src/lib/components/` holds generic reusable UI (buttons, inputs, tables, tabs, modal, notifications, JsonEditor).

### Persistence

- User settings/connections go through `electron-store` (encrypted with a per-platform/arch key) via the `store:get`/`store:set` IPC handlers in `main.js`, surfaced to the renderer as `window.electron.ipcRenderer.store`.

### Tests

- Vitest + jsdom + `@testing-library/svelte`. Convention: `*.test.js` for plain JS (node env), `*.svelte.test.js` for component tests (jsdom, matched by `environmentMatchGlobs` in `vite.config.js`). Store modules are unit-tested next to their source (`src/lib/store/*.test.js`).

### SvelteKit aliases

`svelte.config.js` defines `$store`, `$components`, `$utils`, `$api` aliases — but they point to `src/store`, `src/components`, etc. (no `lib/` prefix). The actual code lives in `src/lib/...`, so most imports use relative paths or `$lib/...`. Double-check before using the aliases.

## Code style

- Use arrow functions (`const foo = () => {}`) for all new functions — top-level helpers, store module exports, and component-local functions alike. Do not use `function` declarations or named `function` expressions in new code. This matches the existing convention in `src/lib/store/*.js` (e.g. `search.js`, `app.js`, `connection.js`) and `Search.svelte`.

## Additional context

`AGENTS.md` in the repo root has an agent-oriented overview that overlaps with this file; prefer this file but consult `AGENTS.md` for the Storeon/IPC skill pointers.
