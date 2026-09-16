# Elastron - Agent Guide

This document is designed to help AI agents understand and contribute to the Elastron project.

## Project Overview
Elastron is a desktop Elasticsearch client built with web technologies. It allows users to connect to Elasticsearch clusters, manage indices, search data, and perform administrative tasks.

## Technology Stack
- **Runtime**: [Electron](https://www.electronjs.org/) (v43)
- **Framework**: [SvelteKit](https://kit.svelte.dev/) (v2, adapter-node) & [Svelte](https://svelte.dev/) (v5, runes)
- **Bundler**: [Vite](https://vitejs.dev/) (v8)
- **State Management**: [Storeon](https://github.com/storeon/storeon)
- **Elasticsearch**: `elasticsearch8` and `elasticsearch9`, both aliases of `@elastic/elasticsearch`
- **AI**: [Vercel AI SDK](https://ai-sdk.dev/) (`ai` v7) with the OpenAI, Anthropic, Google, and OpenAI-compatible providers
- **Styles**: Semantic UI stylesheet (`static/semantic.min.css`) plus component-scoped CSS
- **Testing**: Vitest + jsdom + Svelte Testing Library
- **Build System**: electron-builder

## Architecture
Elastron follows a hybrid SvelteKit + Electron architecture:

1.  **Main Process** (`main.js`):
    -   Entry point.
    -   Creates browser windows.
    -   Manages application lifecycle.
    -   Initializes IPC handlers directly in `main.js`.

2.  **Renderer Process** (`src/`):
    -   Built with SvelteKit.
    -   **SSR/API Routes**: `src/routes/api` handles backend logic, Elasticsearch communication, and the AI chat stream (acting as a "backend for frontend").
    -   **UI**: Svelte components in `src/routes` (pages) and `src/lib` (shared).
    -   **State**: Managed via Storeon `src/lib/store`.

## Key Directories
- **`/`**: Root configuration (`package.json`, `vite.config.js`, `svelte.config.js`).
- **`/src`**: SvelteKit source code.
    - **`routes`**: Pages and API endpoints (`+page.svelte`, `+server.js`).
    - **`lib`**: Shared code.
        - **`components`**: Reusable Svelte components.
        - **`store`**: Storeon modules.
        - **`workspace`**: Workspace-specific components.
        - **`api`**: Client-side API helpers.
        - **`server`**: Server-only code — the Elasticsearch client factory, SSH tunnels, and the AI tool layer (`server/ai`).
        - **`ai`**: The tool catalog and request helpers shared by server and renderer.
- **`/build`**: The built SvelteKit server, which Electron forks in production.
- **`/openspec`**: Specifications (`specs`) and in-flight changes (`changes`).
- **`/docs`**: Images used by the README.

## Development Workflow

### Scripts
- `yarn dev`: Start Vite dev server and Electron in parallel.
- `yarn build`: Build the SvelteKit app into `build/`.
- `yarn start`: Run Electron against an existing `build/`.
- `yarn test`: Run the test suite (`vitest run`).
- `yarn lint`: Run ESLint.
- `yarn dist` / `dist-mac` / `dist-win` / `dist-linux`: Package for distribution.

### Specs first
Behaviour is specified before it is built. `openspec/specs` holds the current specification of each capability; `openspec/changes` holds changes in progress. Update the spec in the same pass as the code.

### Tests
`*.test.js` runs in node, `*.svelte.test.js` in jsdom (see `environmentMatchGlobs` in `vite.config.js`). Tests live next to the code they cover.

### State Management (Storeon)
State is managed using Storeon. Modules are in `src/lib/store/`.
- **Read State**: `const { data } = useStoreon('moduleName')`
- **Write State**: `dispatch('module/action', payload)`

### Elasticsearch Integration
- **Client**: ES 8 and ES 9 are bundled as the aliased packages `elasticsearch8` and `elasticsearch9`. Always create clients through `createClient(connection)` in `src/lib/server/elastic.js`, which picks the client for the connection's version; never import a client package directly in a route.
- **Communication**: Frontend calls SvelteKit API routes (`src/routes/api/...`), which then call Elasticsearch. Adding an operation means adding a `+server.js`, not an IPC handler.
- **Tunnels**: Connections that need one go through `tunnelManager` in `src/lib/server/tunnel.js`, which `createClient` integrates with.
- **Headers**: The client is configured globally to handle `Accept` and `Content-Type` headers correctly for compatibility.

### AI Assistant
- **Route**: `src/routes/api/ai/chat/+server.js` streams a chat turn via `src/lib/server/ai/`.
- **Tools**: `src/lib/server/ai/tools/` defines the tools the model can call; `src/lib/ai/catalog.js` holds the policy shared with the renderer — which tools run on their own and which need the user's approval.
- **Providers**: The user's own API keys, per provider, are kept in the encrypted local store and reach the server with each request. Never log or persist them anywhere else.
- **UI**: The drawer and its cards live in `src/lib/workspace/assistant/`.

## Conventions
See [CLAUDE.md](CLAUDE.md) for the conventions that apply to new code, including Svelte 5 and Storeon patterns, the narrow Electron IPC surface, and the arrow-function style used throughout.

