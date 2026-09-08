## Context

See proposal.md - Why. Today `updater.js` drives the whole update lifecycle from the main process using native `dialog.showMessageBox` calls; the renderer has no visibility into it. `preload.js` already whitelists two incoming channels, `update_available` and `update_downloaded`, that have never been wired to anything (verified back to the first commit that introduced them) — they're unused scaffolding, not remnants of a removed feature. All existing IPC in this app flows renderer→main (`send`/`invoke`); this change introduces the app's first main→renderer push messages.

## Goals / Non-Goals

**Goals:**
- Surface download progress in the footer without touching the two existing native dialogs.
- Give the user a way to trigger the restart/install after dismissing the final dialog with "Later."
- Make the "check for updates" trigger fired from the Dashboard nav actually perform a check.

**Non-Goals:**
- Replacing either native dialog with in-app UI (explicitly ruled out — this codebase has twice been simplified back to native dialogs; see git history on `updater.js`).
- Persisting "update ready to install" state across app restarts. electron-updater's default `autoInstallOnAppQuit` already installs on the next natural quit, so the footer button only needs to live for the rest of the current session.
- Re-scoping *where* the nav-triggered check fires from (still the Dashboard link's `onclick`) — only fixing that it now does something.

## Decisions

**Reuse the two dead channels for state transitions, add one new channel for progress ticks.**
`update_available` (sent right after the user clicks "Download" in the existing dialog) flips the footer into "downloading" state; `update_downloaded` flips it to "downloaded" state. A new `update-download-progress` channel carries `{ percent }` ticks in between. Alternative considered: a single generic `update-status` channel carrying a `{ status, percent }` payload — rejected because it's a bigger deviation from the existing one-channel-per-event convention in `preload.js` for a marginal reduction in channel count, and it would leave the two already-whitelisted channels unused anyway.

**New outgoing channel `restart-and-install` for the footer button.** The footer sends this; `main.js` handles it by calling a new `updater.restartAndInstall()` export that wraps `autoUpdater.quitAndInstall()`. Keeping the `autoUpdater` reference encapsulated in `updater.js` (rather than importing `electron-updater` directly in `main.js`) matches the existing pattern of `checkForUpdates` being the only public surface of that module.

**New Storeon module `src/lib/store/updater.js`.** Holds `{ downloading: boolean, percent: number, downloaded: boolean }`. The module itself registers the `window.electron.ipcRenderer.on(...)` listeners (in its `@init`/setup, guarded for non-Electron/test environments the same way `storage.js` already guards `window.electron` access) and dispatches store actions from them, rather than `Footer.svelte` owning the IPC subscription directly. This keeps the component presentational and keeps IPC plumbing in the store layer, consistent with how `storage.js` is the sole place that touches `window.electron.ipcRenderer.store`.

**Fix, don't relocate, the nav-triggered check.** `main.js`'s `check-for-updates` handler currently only logs; it will call `updater.checkForUpdates()` (no forced "up to date" notification, since it's an incidental trigger off a nav click, not an explicit user request — the menu item's `checkForUpdates(true)` is unchanged).

**Footer layout: progress bar replaces the version text; restart button appears alongside it once downloaded.** While `downloading` is true, the `v{pkg.version}` span is replaced by a progress bar showing the real `download-progress` percent. Once `downloaded` is true, the version text returns and a "Restart to update" button appears next to it until clicked or the app quits.

## Risks / Trade-offs

- Very small/fast downloads may barely show the progress bar before it disappears → acceptable; it's strictly better than the current total silence, no mitigation needed.
- Repurposing the version-text slot during download briefly hides the version number → mitigated by restoring it immediately once the download finishes or errors.
- If `download-progress` never fires (e.g. some platforms/edge cases in electron-updater) the bar could appear stuck at 0% for the whole download → mitigate by also using the `update_available`/`update_downloaded` transition events as the source of truth for showing/hiding the bar, independent of whether any progress ticks arrive.

## Migration Plan

Purely additive; no data migration. Ships in a normal release. No rollback concerns beyond reverting the change.
