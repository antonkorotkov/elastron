## Why

The Playground loses everything the user has typed the moment they navigate to another view. Method, path, request body, headers, target index and response are all component-local `$state` in `PlaygroundLayout.svelte`; the store holds only `currentRequest`, a snapshot of the last *template* that was loaded or saved. On remount, a seeding `$effect` copies that snapshot back over the locals, so returning to the Playground silently resets the request to the most recently selected saved item.

The Search view has the opposite ownership model — the store is the single source of truth, every control reads `$search.x` and dispatches `search/update` — and consequently survives navigation *and* app restart. Playground should behave the same way.

## What Changes

- The `playground` store slice becomes the source of truth for the working request. `currentRequest` stops being a template snapshot and becomes the **live draft**: `{ method, path, bodyText, headers }`, joined by `selectedIndex` and `activeTab`.
- The request body is stored as **text, exactly as typed**, including mid-edit invalid JSON. Parsing happens at send time and at template-save time. Saved templates continue to store a parsed `body` object; `playground/loadTemplate` stringifies on the way in.
- The draft is persisted to `electron-store` under `playground_draft` and rehydrated at startup, so it survives an app restart. `responseBody` and `isRequestLoading` stay in memory only, mirroring how `search/update` omits `response`/`results`/`loading` from what it writes.
- Writes of `bodyText` are **debounced** before hitting storage. Every other field writes through immediately.
- On the `connected` event the Playground clears `selectedIndex` and `responseBody`, mirroring `search.js`'s reset of `index` and `results`. The draft's method, path, body and headers are kept.
  - **Playground resets `selectedIndex` to `null`, not to the literal `'_all'` that Search uses.** Search only feeds `index` into a search call; the Playground interpolates it into an arbitrary path, where `{{index}}` alone under the built-in "Delete Index" template would resolve to `DELETE /_all` and drop every index in the cluster. `null` is the Playground's existing unset state and already resolves that template to a harmless `/`.
- `PlaygroundLayout.svelte` keeps no mirrored local state and the seeding `$effect` is deleted. Controls read from the store and dispatch on change, as `Search.svelte` does.
- The JSON body editor becomes uncontrolled: seeded once on mount from `bodyText`, pushing changes out via `onChangeText`, and updated explicitly via the existing `editor` bindable when a template is loaded.
- **BREAKING (internal):** `playground/hydrate` no longer takes the custom-templates array as its whole payload. It takes `{ templates, draft }`. The only caller is `src/routes/+layout.svelte`.

## Capabilities

### New Capabilities
- `playground`: the request Playground's draft state — what is retained across view navigation and app restart, how a saved template interacts with the working draft, and what is reset when the active connection changes.

### Modified Capabilities
<!-- None. No existing specs under openspec/specs/. -->

## Impact

- `src/lib/store/playground.js` — draft state, `playground/update`, debounced persistence, `connected` handler, `hydrate` signature.
- `src/lib/workspace/playground/PlaygroundLayout.svelte` — remove local `$state` mirrors and the seeding `$effect`; read from and dispatch to the store; drive the editor via `bind:editor`.
- `src/routes/+layout.svelte` — hydrate the draft alongside `playground_templates`; ordering relative to `connection/save`.
- `src/lib/workspace/playground/PlaygroundLayout.svelte.test.js` — updated for store-driven rendering.
- New `src/lib/store/playground.test.js` — none exists today.
- Persisted storage gains one key, `playground_draft`. No migration: an absent key falls back to the existing defaults.

### Explicitly out of scope

- **Stable connection ids.** Connections have no id; `src/lib/store/history.js` identifies them by deep equality of the whole object (`isEqual`, `history.js:95`/`:135`), a smell that file already comments on. Per-connection drafts would need that fixed first. This change keeps a single global draft and resets the index on connection change instead.
- Changing how Search stores its own request body (it keeps the parsed object, losing mid-edit invalid JSON — a known asymmetry this change deliberately does not propagate).
