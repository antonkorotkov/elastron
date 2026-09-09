## Context

See proposal.md for motivation. What shapes the approach:

- Google Analytics is wired only in `src/routes/+layout.svelte`: a head snippet loads `gtag.js` when `PUBLIC_GA_ID` is set, and `afterNavigate` calls `gtag('config', PUBLIC_GA_ID, { page_path })`, which is what actually sends page views.
- The head snippet's inline `gtag('config', '{PUBLIC_GA_ID}', ...)` is compiled verbatim: Svelte does not interpolate inside `<script>` text. That call configures a bogus tag and is dead weight today, but anything attached to it would be lost.
- `.env` is gitignored and holds `PUBLIC_GA_ID`. The ID chosen at build time is the only switch: it decides both whether analytics runs and which property receives it, in dev and in packaged builds alike. This change keeps that logic untouched.
- The cluster version is obtained in `src/lib/store/connection.js` from `api.test()`. The `connected` store event is dispatched on line 90 before the version is written to the store on lines 100-101, so a listener on `connected` cannot read `state.server.version`. Nine modules already listen to `connected` and none take a payload.
- The app version is available to the renderer via `import pkg from '../../../package.json'`, as `Footer.svelte` already does.
- `connection/save` runs on every window mount and on every explicit connect, so `connected` fires once per window per connection, including automatic reconnect at launch.
- GA4 limits: event parameter values are capped at 100 characters, user property values at 36, and custom parameters only appear in reports once registered as custom dimensions in the property's admin.

## Goals / Non-Goals

**Goals:**

- One place in the renderer that knows about `gtag`, so components and stores never call the global directly and tests never need it.
- Zero analytics traffic from builds without a measurement ID; no change to the existing build-time switch.
- Everything sent is enumerable from the spec: no free-text fields.

**Non-Goals:**

- Error or exception reporting of any kind (rejected in the proposal on privacy grounds).
- Analytics from the Electron main process or the SvelteKit server process (updater, tunnel). Only the renderer reports.
- A user-facing analytics opt-out. Worth a separate change if requested; this change does not add new data categories that would force it.
- Any dev-mode suppression or alternative routing. The maintainer points `PUBLIC_GA_ID` at whichever property should receive a given build's traffic.
- Deduplicating connect events per session. One event per window per connection is the intended unit.

## Decisions

### D1. A `gtag` wrapper in `src/lib/utils/analytics.js`, not direct calls

Exports arrow functions such as `trackEvent(name, params)`, `setUserProperties(props)` and `trackPageView(path)`. Each checks that `PUBLIC_GA_ID` is set and that `window.gtag` is a function, otherwise returns without doing anything. The wrapper is the only file that references `gtag` or `PUBLIC_GA_ID`.

Why: Storeon modules are unit-tested in node without a DOM; a wrapper that no-ops when `gtag` is absent keeps those tests clean, and the measurement-ID guard lives in one place instead of at every call site.

Alternative considered: keep calling `gtag` inline from the layout and the store. Rejected because every call site would repeat the same guards and the store test would need a global stub.

### D2. App version as a user property, set once per window before the first page view

In the layout's `onMount`, before `afterNavigate` can fire, call `setUserProperties({ app_version: pkg.version })`. gtag queues into `dataLayer`, so ordering relative to script load does not matter; ordering relative to the first `config` call does, hence `onMount` rather than a store listener.

Why user property over event parameter: the question this answers is "how many users run release X", which is a user-scoped report. An event-scoped parameter would give "how many page views came from release X" and would need to be threaded into every future event by hand. Semver strings fit the 36-character user property cap.

Alternative considered: pass `app_version` in the `config` call. Rejected because config parameters are event-scoped and the head snippet bug shows how easy it is to attach them to the wrong tag.

### D3. Carry the cluster version in the `connected` event payload

Change `store.dispatch('connected')` in `connection.js` to `store.dispatch('connected', { version, flavor })`, computed from `test.version` before dispatch. Existing listeners ignore the argument.

`connected` has a second dispatch site: the Quick Connect form in `ConnectDialog.svelte` runs its own `api.test()` and dispatches `connected` directly instead of going through `connection/save`. Found during implementation; it must pass the same payload, otherwise user-initiated Quick Connects would be the one path that never reports. Both sites derive the payload the same way (`getVersionNumber(test.version)` and `test.version?.build_flavor`).

Why: `connected` is the one event that means exactly "a connection was established". The alternatives count the wrong thing:

- Listening to `server/update` also fires on the `server/info` refresh at every mount and on version-less updates.
- Listening to `connection/update` fires on form edits.
- Moving the `connected` dispatch after the version write would reorder side effects in nine other modules for no gain.

### D4. A Storeon `analytics` module in `src/lib/store/analytics.js`

Registers `store.on('connected', (state, payload) => trackEvent('cluster_connected', { es_version, es_flavor }))`, omitting `es_flavor` when absent. Holds no state of its own, so it needs no `@init`. Registered in `store/index.js`. Tested next to its source by injecting a fake tracker, following the `server.test.js` pattern.

Why a module rather than a call inside `connection.js`: the connection store should not know analytics exists, and future events (if any) get an obvious home.

### D5. Fix the head snippet by removing the bogus config, not by interpolating

The inline script keeps only the `dataLayer` bootstrap and `gtag('js', new Date())`. The `async` script tag keeps its attribute interpolation, which Svelte does handle. The real `gtag('config', PUBLIC_GA_ID, ...)` continues to come from the layout script via the wrapper. The `{#if PUBLIC_GA_ID}` gate on the head block is unchanged.

Why: the config call already lives in the layout script where interpolation works. Duplicating it into the head via string concatenation would send two page views per initial load.

### D6. Event and parameter naming

`cluster_connected` with `es_version` and `es_flavor`; user property `app_version`. All lowercase snake_case, under GA4's 40-character name limit, and none collide with GA4 reserved names (`app_version` is reserved only for Firebase app streams, not web streams, and is the natural name for the user-scoped dimension).

## Risks / Trade-offs

- [Custom dimensions not registered in GA admin] → The values arrive on every hit but are invisible in standard reports until `app_version` (user-scoped) and `es_version`, `es_flavor` (event-scoped) are registered. Listed as an explicit task; dimensions apply from registration onward, not retroactively, so do it before shipping the release.
- [Offline at launch] → `gtag.js` never loads, `dataLayer` fills, nothing is sent. The connect event for an offline user is lost. Accepted: analytics is best-effort and the app is unaffected.
- [Multiple windows inflate connect counts] → Intended per D4 non-goals; interpret `cluster_connected` as "a window connected", not "a session connected".
- [Manual verification pollutes the production property] → Point `PUBLIC_GA_ID` in `.env` at a test property while verifying, or accept a handful of known hits; GA4 DebugView shows hits within seconds either way.
- [Adding a payload to `connected`] → Storeon passes extra arguments harmlessly; a grep confirmed no listener destructures a payload. Covered by existing store tests.

## Migration Plan

Ship in the next release. No data migration, no settings change, no rollback concern beyond reverting the commit. The GA admin step is independent of the release and can be done first.
