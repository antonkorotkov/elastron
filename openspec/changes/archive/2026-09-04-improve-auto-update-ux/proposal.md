## Why

The auto-update flow goes silent for the entire download: the user sees a "Download" dialog, clicks it, and then nothing happens visibly until a "Restart and Install" dialog appears later. There is no feedback that a download is even in progress, and no way to trigger the restart later if the user dismisses that final dialog. Separately, the app's "check for updates" action triggered from the Dashboard nav link is currently a no-op in the main process, so it silently does nothing.

## What Changes

- Add a `download-progress` listener in `updater.js` and forward percent-complete to the renderer over IPC as the download proceeds.
- Add a small progress bar in the footer, in place of the version number, that fills as the update downloads.
- Wire up the two IPC channels (`update_available`, `update_downloaded`) that are already whitelisted in `preload.js` but never sent, so the renderer knows when a download starts and finishes.
- Keep the existing native "Found Updates" (Download/Later) and "Install Updates" (Restart and Install/Later) dialogs unchanged.
- Add a "Restart to update" button in the footer that appears once a download has finished, for the case where the user dismissed the restart dialog with "Later." Clicking it triggers the same restart-and-install action as the dialog's button.
- Fix `main.js`'s `check-for-updates` IPC handler, which currently only logs, to actually invoke `updater.checkForUpdates()`.

## Capabilities

### New Capabilities
- `auto-update`: Defines how the app checks for, downloads, and installs updates from GitHub releases, and how download/ready-to-restart state is surfaced to the user during that process.

### Modified Capabilities
(none — this is the first spec for update behavior)

## Impact

- `updater.js`: new `download-progress` listener, sends on the two existing (currently unused) channels plus a new progress channel, exposes a way to trigger `quitAndInstall()` from a renderer-initiated IPC message.
- `main.js`: fix the `check-for-updates` handler; add a `restart-and-install` handler.
- `preload.js`: whitelist a new incoming `update-download-progress` channel and a new outgoing `restart-and-install` channel.
- `src/lib/store/`: new `updater` Storeon module tracking download/ready state, registered in `src/lib/store/index.js`.
- `src/lib/footer/Footer.svelte`: conditional progress bar and restart button.
- No breaking changes; no new dependencies.
