# Elastron - Agent Guide

This document is designed to help AI agents understand and contribute to the Elastron project.

## Project Overview
Elastron is a desktop Elasticsearch client built with web technologies. It allows users to connect to Elasticsearch clusters, manage indices, search data, and perform administrative tasks.

## Technology Stack
- **Runtime**: [Electron](https://www.electronjs.org/) (v40+)
- **Framework**: [SvelteKit](https://kit.svelte.dev/) (v2+) & [Svelte](https://svelte.dev/) (v5)
- **Bundler**: [Vite](https://vitejs.dev/) (v7)
- **State Management**: [Storeon](https://github.com/storeon/storeon)
- **Backend (Main)**: Node.js with `@elastic/elasticsearch` (v8.12.0)
- **Styles**: SCSS / SASS
- **Testing**: Vitest
- **Build System**: electron-builder

## Architecture
Elastron follows a hybrid SvelteKit + Electron architecture:

1.  **Main Process** (`main.js`):
    -   Entry point.
    -   Creates browser windows.
    -   Manages application lifecycle.
    -   Initializes IPC handlers (`app/ipc-main.js`).

2.  **Renderer Process** (`src/`):
    -   Built with SvelteKit.
    -   **SSR/API Routes**: `src/routes/api` handles backend logic and Elasticsearch communication (acting as a "backend for frontend").
    -   **UI**: Svelte components in `src/routes` (pages) and `src/lib` (shared).
    -   **State**: Managed via Storeon `src/lib/store`.

## Key Directories
- **`/`**: Root configuration (`package.json`, `vite.config.js`, `svelte.config.js`).
- **`/app`**: Main process modules (deprecated/moving to SvelteKit server routes?).
- **`/src`**: SvelteKit source code.
    - **`routes`**: Pages and API endpoints (`+page.svelte`, `+server.js`).
    - **`lib`**: Shared code.
        - **`components`**: Reusable Svelte components.
        - **`store`**: Storeon modules.
        - **`workspace`**: Workspace-specific components.
        - **`api`**: Client-side API helpers.
- **`/dist`**: Built assets.

## Development Workflow

### Scripts
- `yarn dev`: Start Vite dev server and Electron in parallel.
- `yarn build`: Build SvelteKit app and Electron main process.
- `yarn test`: Run unit tests.
- `yarn dist`: Package for distribution.

### State Management (Storeon)
State is managed using Storeon. Modules are in `src/lib/store/`.
- **Read State**: `const { data } = useStoreon('moduleName')`
- **Write State**: `dispatch('module/action', payload)`

### Elasticsearch Integration
- **Client**: `@elastic/elasticsearch` v8.12.0 is used in SvelteKit server routes (`src/routes/api/elastic`).
- **Communication**: Frontend calls SvelteKit API routes (`src/routes/api/...`), which then call Elasticsearch.
- **Headers**: The client is configured globally to handle `Accept` and `Content-Type` headers correctly for compatibility.

## Agent Skills
- **[Frontend Development](.agent/skills/svelte-storeon.md)**: Svelte 5 & Storeon patterns.
- **[IPC Communication](.agent/skills/electron-ipc.md)**: Handling Electron IPC.

