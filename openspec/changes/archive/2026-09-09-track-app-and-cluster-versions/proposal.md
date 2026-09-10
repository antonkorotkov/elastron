## Why

Google Analytics currently receives only page views, so there is no way to learn which Elastron releases people are running or which Elasticsearch versions they connect to. Both answers drive support decisions: when a release can be considered retired, and which cluster versions must stay tested. Error reporting was considered and rejected because Elasticsearch error messages carry index names, hostnames and field values that cannot be sent to Google Analytics under its terms; version strings carry none of that.

## What Changes

- Report the running app version to Google Analytics as a user property, so every event already sent (page views today, anything added later) carries it without per-event work.
- Send a `cluster_connected` event each time a connection to an Elasticsearch cluster is established, carrying the cluster's version number and build flavor.
- Fix the head snippet in the root layout, whose inline `gtag('config', ...)` call uses the literal text `{PUBLIC_GA_ID}` because Svelte does not interpolate inside `<script>` text. All analytics calls route through the real measurement ID.
- Add a small analytics wrapper and a Storeon `analytics` module so future events have one place to live and can be unit-tested without a real `gtag`. Whether analytics is on, and which property it targets, continues to be decided solely by `PUBLIC_GA_ID` at build time.

## Capabilities

### New Capabilities
- `usage-analytics`: what the app reports to Google Analytics, when, with which fields, and when it stays silent.

### Modified Capabilities
<!-- none: connection behaviour is unchanged; the `connected` store event gains a payload but that is an implementation detail -->

## Impact

- `src/routes/+layout.svelte`: head snippet fix, set the app-version user property on mount, route page views through the wrapper.
- `src/lib/store/connection.js`: pass the cluster version along with the `connected` event.
- New `src/lib/utils/analytics.js` (gtag wrapper) and `src/lib/store/analytics.js` (store module), registered in `src/lib/store/index.js`, with tests next to each.
- Google Analytics admin: two custom dimensions must be registered (user-scoped `app_version`, event-scoped `es_version`) or the values arrive but stay invisible in reports. Not code, but part of the change.
- No new dependencies. No change to persisted settings, IPC or the Electron main process.
