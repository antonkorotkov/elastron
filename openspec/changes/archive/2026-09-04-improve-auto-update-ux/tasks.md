## 1. Main process: progress + restart wiring

- [x] 1.1 In `updater.js`, add an `autoUpdater.on('download-progress', ...)` listener that sends `update-download-progress` with `{ percent }` over `webContents.send`; verify by manually forcing a download (e.g. against a test release) and observing the channel fire in devtools.
- [x] 1.2 Send `update_available` right after the user chooses "Download" in the existing "Found Updates" dialog, and `update_downloaded` when `update-downloaded` fires, using the two channels already whitelisted in `preload.js`.
- [x] 1.3 Add `restartAndInstall()` to `updater.js`'s exports, wrapping `autoUpdater.quitAndInstall()`.
- [x] 1.4 In `main.js`, add `ipcMain.on('restart-and-install', () => updater.restartAndInstall())`.
- [x] 1.5 Fix `main.js`'s `ipcMain.on('check-for-updates', ...)` handler to call `updater.checkForUpdates()` instead of only logging.

## 2. Preload channel whitelist

- [x] 2.1 Add `update-download-progress` to the incoming (`on`) channel whitelist in `preload.js`.
- [x] 2.2 Add `restart-and-install` to the outgoing (`send`) channel whitelist in `preload.js`.

## 3. Renderer store module

- [x] 3.1 Create `src/lib/store/updater.js`: Storeon module with state `{ downloading, percent, downloaded }`, actions to handle the `update_available`, `update-download-progress`, and `update_downloaded` IPC events (guarding `window.electron` access the same way `src/lib/utils/storage.js` does), and a dispatchable action that sends `restart-and-install`. Verify with a unit test (`updater.test.js`) covering each state transition, following the pattern in `src/lib/store/notifications.test.js`.
- [x] 3.2 Register the new `updater` module in `src/lib/store/index.js`.

## 4. Footer UI

- [x] 4.1 In `Footer.svelte`, read the `updater` store and, while `downloading` is true, replace the `v{pkg.version}` span with a progress bar reflecting `percent`.
- [x] 4.2 When `downloaded` is true, show a "Restart to update" button next to the version text that dispatches the restart action; verify with a `Footer.svelte.test.js` case for each of the three states (idle, downloading, downloaded), following the pattern in `Footer.svelte.test.js`.

## 5. Manual verification

- [x] 5.1 Run the packaged app (or a build pointed at a test GitHub release) through the full flow — check for update, download with progress bar visible, dismiss the restart dialog with "Later," confirm the footer's "Restart to update" button appears and installs on click.
- [x] 5.2 Confirm the Dashboard nav link's `check-for-updates` trigger now actually performs a check (e.g. via console/log output or network activity), where previously it was a no-op.
