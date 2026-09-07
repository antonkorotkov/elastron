## Context

See proposal.md for motivation. The constraints that shape the approach:

- The `search` store slice (`src/lib/store/search.js`) is flat: configuration, results, transient state and the per-index column layouts all sit side by side. Every consumer goes through one `search/update` action, which also persists the configuration to the `lastSearch` storage key on every call.
- Four components read `$search` directly (`Search.svelte`, `SearchControls.svelte`, `EditControls.svelte`, `ResultsTable.svelte`; `ProfileTable.svelte` reads through the store as well). Their tests mock a flat search store.
- The async handlers (`search/run`, `search/documents/*`) capture state at dispatch time and later dispatch `search/update` with results. Nothing today ties a response to the configuration that produced it.
- The request body editor and the results editor are imperative JSONEditor instances created once on mount. The body editor is only re-set in specific flows; the results editor is synced through an effect that tracks the previous view. Component-local state (expanded rows, row detail pane, sidebar toggle, edit permission flag) is not in the store at all.
- The `Search.svelte` markup already hides inactive editors with `class:hidden` rather than unmounting them, and the virtual results table measures its container with an action.
- The playground store already implements a debounced draft write with a flush on window close.

## Goals / Non-Goals

**Goals:**

- Tabs are the only source of truth for search state. No mirror of the active tab exists anywhere.
- Every write to a tab is addressed by tab id. Async outcomes cannot land in the wrong tab.
- Tab instances stay alive across switches so imperative editor state survives without a sync layer.
- The store reshape is verifiable on its own before the tab bar exists.

**Non-Goals:**

- Opening a tab from the dashboard or any other view. That is a separate change; this design only leaves a clean action for it to call.
- Per-connection tab sets. Tabs are global; there is no stable connection identity to key them on.
- Persisting results, editor text, or working state.
- Drag reordering of tabs or keyboard shortcuts.

## Decisions

### Store shape: tabs are the only truth

`state.search` becomes `{ tabs: Tab[], activeId }`, where a tab is `{ id, title, ...config, ...results, loading, editDoc }`. Config fields are exactly today's persisted fields; result fields are exactly today's non-persisted ones.

Alternative considered: keep the flat slice as a mirror of the active tab and add a tab list beside it. Rejected because two copies of the active tab invite drift, and the mirror only exists to avoid touching components that must be touched anyway for per-tab dispatch.

### Every action names its tab

`search/update` takes `{ id, patch }`. `search/run` and `search/documents/*` take the tab id and carry it through to the update they dispatch on completion. A tab that no longer exists when an outcome arrives is a no-op. Tab lifecycle actions are `search/tabs/add`, `search/tabs/close`, `search/tabs/switch`, `search/tabs/rename`.

Alternative considered: `search/update` defaults to the active tab when no id is given. Rejected because the default is exactly the path that reintroduces the race, and with per-tab component instances there is no caller that lacks an id.

A helper that finds a tab by id, and one that produces a default tab, live in the store module and are exported for tests.

### Column layouts get their own module

`tableConfigs` and its `search/tableConfigs/*` actions move to a new store module keyed by index. `ResultsTable` reads it from the store as a second slice. Rationale: layouts are shared across tabs and have their own persistence key already; keeping them inside a per-tab slice would force every tab to carry a copy or every reader to reach past the tab.

### The page hosts one component instance per visited tab

`src/routes/search/+page.svelte` renders the tab bar and an `{#each}` over tabs that have been activated at least once, keyed by tab id, each hosting a `Search.svelte` with `tab` as a prop and hidden unless active. A tab mounts the first time it becomes active and is destroyed only when closed.

`Search.svelte` derives nothing from the store about which tab it is; it receives `tab` and passes it to `SearchControls`, `EditControls`, `ProfileTable` and `ResultsTable` as a prop alongside the editor handles it already passes. Every dispatch from those components uses `tab.id`.

Alternatives considered:

- Remount on switch with `{#key activeId}`: simplest, but discards half-typed request body text, scroll and expanded rows on every switch.
- Sync editors in place on switch: preserves nothing extra over remount without also lifting every piece of component-local state into the store.
- Mount all persisted tabs at startup: creates an Ace editor and a virtual table per tab inside hidden containers, which measure a zero-size box on creation.

On becoming visible, a tab instance calls resize on its Ace editors. The search results table turned out to be a plain HTML table inside an overflow container, not the dashboard's virtual table, so it needs no re-measure.

### Persistence and migration

The persisted shape under a new `searchTabs` key is `{ tabs: [{ id, title, ...config }], activeId }`. Writes are debounced and flushed on window close, following the playground draft pattern, because the body editor fires a change per keystroke and the payload now scales with the number of tabs.

Hydration sanitizes: unknown fields dropped, missing config fields filled from the default tab, malformed tabs skipped, unknown `activeId` replaced by the first tab, empty list replaced by one default tab. If `searchTabs` is absent and `lastSearch` is present, `lastSearch` is wrapped as the single tab and written under `searchTabs` on the next persist, so migration happens once. `lastSearch` is not deleted, so a downgrade still finds it.

### Connection change

The `connected` handler clears every tab's result fields, sets `editDoc` to null, and moves any tab in the `edit` view to `hits`. Index and configuration are kept. Rationale: staging and production frequently share index names, and a user who set up tabs for them should not lose that on reconnect. Today's reset to `_all` existed only because a stale single index was confusing; per-tab titles make the index visible enough.

### Tab bar

A `SearchTabs.svelte` component using the app's existing secondary pointing menu style. Each tab shows its title, a loading indicator while its query runs, and a close control. An add control sits at the end. Double click on a title enters rename; an empty title clears the custom title so it follows the index again. Title derivation lives in the store: `title` is null until the user sets it, and the displayed title is `title ?? index`.

The bar never wraps. The search view reserves a fixed height for it, so a second row would push the view off the bottom of the window. Overflow scrolls horizontally with the scrollbar track hidden, since an overlay track covered the tabs; the active tab is scrolled into view whenever it changes, and a vertical mouse wheel over the bar is translated into sideways scroll since the page itself does not scroll.

The rename input shares the title's line box, with the height fixed at the smallest box Chromium gives a text input and the title carrying the caret padding an input reserves, so entering and leaving rename mode moves nothing.

### Tab cap

Twenty tabs. `search/tabs/add` refuses and emits a notification at the cap. The cap exists because every open tab holds two editors and its results DOM; it is a memory bound, not a UX preference.

### Constraint for the future dashboard action

The future "open index in a tab" action must reuse an existing tab whose configuration equals the default tab except for the index, and otherwise add a new tab. This is recorded here so that the default tab and a "pristine" comparison helper are designed with it in mind, but the action itself is out of scope.

## Risks / Trade-offs

- [Hidden editors mis-size when first shown] → resize the Ace editors on activation; the results table is a plain table and lays itself out.
- [Memory grows with open tabs] → tab cap of twenty; results are already bounded by the size field and the rendered-rows cap in the table.
- [A response arrives for a closed tab] → handlers look the tab up by id on completion and drop the outcome when absent.
- [Persist storms while typing] → debounced write with flush on close; abrupt exit inside the debounce window loses at most the last few hundred milliseconds of edits, matching the playground.
- [Component tests all mock a flat store] → the tests are rewritten to pass `tab` as a prop; child components no longer need a store mock for tab data, only for dispatch and layouts.
- [Header view reset targets a tab that may not be mounted] → it dispatches `search/update` against `activeId`, which works on store data regardless of mount state.
- [Migration runs on a corrupted `lastSearch`] → the same sanitizer applies; a bad value yields a default tab.

## Migration Plan

1. Reshape the store with a single default tab, move column layouts to their own module, update every component to take `tab` as a prop and dispatch by id, rewrite tests. The app behaves exactly as before with one tab. Ship-able on its own.
2. Add lifecycle actions, the per-tab host, the tab bar, persistence with migration.
3. Rollback is a revert; `lastSearch` is left in place so an older build restores its single search.

## Open Questions

- Whether the results editor of a hidden tab should apply updates while hidden or defer them until activation. Deferring saves work for background runs but adds a state flag; applying immediately is simpler and correct. Start with immediate and revisit if switching feels slow.
