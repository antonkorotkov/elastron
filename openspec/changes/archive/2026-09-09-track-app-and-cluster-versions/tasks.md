## 1. Analytics wrapper

- [x] 1.1 Create `src/lib/utils/analytics.js` exporting arrow functions `isAnalyticsEnabled`, `trackPageView(path)`, `trackEvent(name, params)` and `setUserProperties(props)`; each no-ops unless `PUBLIC_GA_ID` is set and `window.gtag` is a function. Verify with `src/lib/utils/analytics.test.js` covering: no gtag present, missing ID, and the exact `gtag` arguments produced for each call.

## 2. Layout wiring

- [x] 2.1 In `src/routes/+layout.svelte`, remove the bogus `gtag('config', '{PUBLIC_GA_ID}', ...)` from the inline head script, keeping the `dataLayer` bootstrap, `gtag('js', ...)` and the existing `{#if PUBLIC_GA_ID}` gate. Verify by running `yarn build` and grepping `build/` for `'{PUBLIC_GA_ID}'`, which must return nothing.
- [x] 2.2 Replace the inline `gtag('config', ...)` in `afterNavigate` with `trackPageView(to.url.pathname)` from the wrapper. Verify `grep -rn "gtag(" src` reports matches only in `src/lib/utils/analytics.js` and the head bootstrap.
- [x] 2.3 In the layout `onMount`, before any dispatch, call `setUserProperties({ app_version: pkg.version })` using the same `package.json` import pattern as `Footer.svelte`. Verify in the built app with GA4 DebugView (or a `dataLayer` inspection in devtools) that the `set user_properties` entry precedes the first `config` entry.

## 3. Connection event payload

- [x] 3.1 In `src/lib/store/connection.js`, compute `version` (via `getVersionNumber`) and `flavor` (`test.version?.build_flavor`) before the `connected` dispatch and pass them as `store.dispatch('connected', { version, flavor })`. Verify `yarn vitest run src/lib/store/connection.test.js` passes and add an assertion that `connected` is dispatched with that payload.
- [x] 3.2 In `src/lib/components/modal/ConnectionDialog/ConnectDialog.svelte`, Quick Connect dispatches `connected` on its own after a successful `api.test()`; pass the same `{ version, flavor }` payload there. Verify `yarn vitest run src/lib/components/modal/ConnectionDialog/ConnectDialog.svelte.test.js` passes with an assertion on that payload, and that a Quick Connect in the running app pushes `cluster_connected` onto `dataLayer`.

## 4. Analytics store module

- [x] 4.1 Create `src/lib/store/analytics.js` with a factory that accepts a tracker (defaulting to the wrapper's `trackEvent`) and listens to `connected`, sending `cluster_connected` with `es_version` and, only when present, `es_flavor`. Verify with `src/lib/store/analytics.test.js` covering: payload with flavor, payload without flavor, and no event when `connected` carries no version.
- [x] 4.2 Register the module in `src/lib/store/index.js`. Verify `yarn test` and `yarn lint` pass.

## 5. Verification and GA admin

- [x] 5.1 Run the built app (`yarn build && yarn start`) with a measurement ID against a cluster, open GA4 DebugView, and confirm: one `page_view` on load carrying `app_version`, one `cluster_connected` with `es_version` and `es_flavor`, and a second `cluster_connected` after opening a new window.
- [x] 5.2 In the GA4 property admin, register custom dimensions: user-scoped `app_version`, event-scoped `es_version` and `es_flavor`. Verify they appear under Admin > Custom definitions before the release is published.
