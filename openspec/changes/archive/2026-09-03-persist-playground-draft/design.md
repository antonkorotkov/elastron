## Context

See `proposal.md` — Why. The mechanism, in one line: `PlaygroundLayout.svelte:20-36` holds the request in component-local `$state`, and the `$effect` at `:72-86` re-seeds those locals from `$playground.currentRequest` on every mount, so a remount overwrites the user's work with the last template snapshot.

Two constraints shape the approach:

- **`Search.svelte` is the reference implementation.** The store owns the state, controls read `$search.x` and dispatch `search/update`, and the component holds nothing but editor instances (`Search.svelte:19-21`, `:294`, `:307`, `:450`). Persistence rides along inside the reducer (`search.js:211`) and is rehydrated at `+layout.svelte:73-76`. Playground should converge on this shape rather than invent a second one.
- **The Playground interpolates the index into an arbitrary path**, unlike Search, which only ever passes `index` to a search call. `PlaygroundLayout.svelte:119-130` substitutes `{{index}}` or strips it. This makes the "unset index" value a safety-relevant choice rather than a cosmetic one.

## Goals / Non-Goals

**Goals:**

- One source of truth for the working request, so the whole class of "remount clobbers local state" bugs is removed rather than patched at this one site.
- Persistence that cannot lose keystrokes on navigation, and loses at most a debounce window on an abrupt exit.
- Naming that stops a template snapshot and a live draft from sharing one field.

**Non-Goals:**

- Reworking Search's own body handling. Search stores the parsed object and drops mid-edit invalid JSON; this change does not propagate that to Playground, nor fix it in Search.
- A dirty/revert indicator ("this draft differs from the template it came from"). The split of `draft` from templates makes it possible later; it is not built here.
- Per-connection drafts, and therefore stable connection ids. See `proposal.md` — Explicitly out of scope.

## Decisions

### Rename `currentRequest` to `draft`, and let it hold body *text*

`currentRequest` is doing double duty: "the template I loaded" and "the request I am editing". Those diverge the instant the user types, and conflating them is the proximate cause of the bug. The field is read in exactly one place (`PlaygroundLayout.svelte:73`) and written in two reducers, so the rename is cheap and prevents the next person from re-conflating them.

```
playground: {
  draft: {                         // persisted as 'playground_draft'
    name,                          //   label last used when saving
    method, path,
    bodyText,                      //   string, exactly as typed
    headers,
    activeTab,                     //   'body' | 'headers'
  },
  selectedIndex: null,             // NOT persisted - see below
  responseBody: {},                // in-memory only
  isRequestLoading: false,         // in-memory only
  builtinTemplates,
  customTemplates,                 // persisted as 'playground_templates' (unchanged)
  isDrawerOpen,
}
```

`bodyText` as a string, rather than a parsed object, is what makes "retained exactly as typed" achievable — a parsed representation cannot round-trip `{ "query": { "bool":`. Parsing moves to the two places that genuinely need an object: `sendRequest` and `saveTemplate`, both of which already call `readRequestBody()` and already report failures. Templates continue to store parsed `body` objects, so `playground_templates` needs no migration; `playground/loadTemplate` stringifies on the way in.

*Alternative considered:* store both `bodyText` and a last-known-good parsed `body`. Rejected — two representations of one thing is how the original bug started, and no consumer needs the parsed form outside those two call sites.

### `selectedIndex` lives in the store but is not persisted

It must be in the store to survive navigation. Persisting it to disk would be dead weight: the `connected` event clears it, and `connected` fires during startup (`+layout.svelte:70`), so a persisted value would be wiped on every launch before the user could see it. Leaving it out of the persisted payload keeps the stored shape honest about what actually comes back.

### The unset index is `null`, never the string `_all`

Search resets `index` to `'_all'` (`search.js:65`) because it only feeds a search call. The Playground substitutes into a path:

```
                     selectedIndex = null      selectedIndex = '_all'
{{index}}/_search -> /_search                  /_all/_search      both fine
{{index}}         -> /                         /_all              NOT fine
```

`built-in-5` is `DELETE {{index}}` (`playground.js:76-83`), one click from the drawer. With `'_all'` that resolves to `DELETE /_all`, which drops every index in the cluster. `null` is the existing unset state and already resolves it to a harmless `/`. The user-visible behaviour ("the index is cleared when you switch clusters") is identical; only the sentinel differs.

### Debounce the *persistence*, not the dispatch

The distinction matters. Debouncing the dispatch would leave the store lagging the editor by the debounce window, so navigating away mid-window would lose the last keystrokes — reintroducing the reported bug in a smaller form. Debouncing only the `setStorage` call keeps the store always current, so navigation is always lossless; only an abrupt process exit within the window can lose anything.

- `playground/update` always writes the store synchronously.
- A patch touching only `bodyText` schedules a debounced write (~300ms, `lodash/debounce` — already a dependency across store modules).
- A patch touching any other field writes through immediately and flushes any pending body write with it, so the two can never persist out of order.
- The debounced writer exposes `flush()`, called from the `beforeunload` handler already registered at `+layout.svelte:89` and used by tests instead of fake timers.

*Alternative considered:* a generic `setStorageDebounced` in `utils/storage.js`. Rejected for now — it would invite changing Search's write behaviour as a side effect, which is out of scope.

Worth noting this is a *reduction* in write volume relative to the house norm: `search/update` currently does a synchronous `electron-store` JSON write per keystroke via `onEditorChange` (`Search.svelte:33-43`).

### The body editor becomes uncontrolled

With `bodyText` as the stored form, the editor can no longer be driven by `JsonEditor`'s `value` object prop — feeding text back in on every keystroke would fight the cursor. It follows Search's model instead: seeded once on mount, pushing out via `onChangeText`, and explicitly updated when a template is loaded. `JsonEditor.svelte:9` already exposes `editor = $bindable(null)`, so `bind:editor` plus `setText()` covers the template-load case with no new wrapper API.

This is also what allows the seeding `$effect` to be deleted outright rather than guarded. A guarded effect would still be a mirror, and mirrors drift.

### `playground/hydrate` moves above `connection/save` in the layout

Today `+layout.svelte` dispatches `connection/save` at `:70` and `playground/hydrate` at `:86`. It happens to work: `connection/save` is `async` and suspends on `await closeTunnel(...)` before reaching `dispatch('connected')`, so the synchronous hydrate at `:86` lands first. That is an accident of microtask ordering, not a guarantee. Moving the playground hydrate above `connection/save` makes the ordering explicit and survives any future refactor of the connect path.

## Risks / Trade-offs

- **Abrupt exit loses up to one debounce window of body text.** → `flush()` on `beforeunload`, which already exists as a hook. A hard kill (`SIGKILL`, power loss) can still lose ~300ms of typing; accepted as proportionate.
- **Two windows share one `playground_draft` key, last write wins.** → Accepted. `lastSearch` and `tableConfigs` already behave this way, so this introduces no new class of problem; per-window drafts would need the same identity work that per-connection drafts do.
- **A persisted `path` can name an index that does not exist on the newly connected cluster.** → Not mitigated. Only the `{{index}}` placeholder is connection-scoped; a literal index the user typed into the path is their text, and silently rewriting it would be worse than a 404.
- **Renaming `currentRequest` while changing its meaning is two edits at once.** → The field has one reader and two writers, and both changes serve the same goal; splitting them into two passes would leave an intermediate state where the name still lies about the contents.
- **Making the store module hold a debounce timer makes it stateful across tests.** → The exported `flush()` gives tests a deterministic seam, and `playground.test.js` is new, so there is no existing suite to retrofit.

## Migration Plan

No data migration. `playground_draft` is a new key; its absence falls back to the current defaults (`playground.js:3-9`), which is exactly what a first run looks like today. `playground_templates` is untouched. Rollback is reverting the commit — a stale `playground_draft` left in `electron-store` is simply never read.

## Open Questions

None blocking. One adjacent observation, deliberately left alone:

`playground/saveTemplate` has an update-in-place branch keyed on `request.id` (`playground.js:125-134`), but its only caller passes `{ name, method, path, body, headers }` with no `id` (`PlaygroundLayout.svelte:59-65`), so `findIndex` always returns `-1` and every save creates a new template. Saving twice under the same name yields duplicates. That is a pre-existing bug in template management, not draft state, and fixing it here would widen the change; it is noted so the next reader does not assume the branch works.
