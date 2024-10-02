const { autoUpdater } = require('electron-updater')

const pkg = require('../package.json')
const { dialog } = require('electron')

autoUpdater.autoDownload = false

let notifyUpdateNotAvailable = false

const init = window => {
  autoUpdater.on('error', async e => {
    await dialog.showMessageBox(window, {
      type: 'error',
      title: 'Oops...',
      message: `Could not automatically update the app because: ${e.message || 'unknown error'}. Please, consider downloading the new version from https://elastron.eney.solutions`,
    })
  })

  autoUpdater.setFeedURL({
    host: null,
    provider: 'github',
    token: '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',
    owner: 'antonkorotkov',
    repo: 'elastron',
  })

  autoUpdater.on('update-available', async () => {
    const answer = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Found Updates',
      message: 'The new version of Elastron is available.',
      buttons: ['Download Silently', 'Later'],
    })

    if (answer.response === 0) autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-not-available', async () => {
    if (!notifyUpdateNotAvailable) return

    await dialog.showMessageBox(window, {
      title: 'Updates Not Available',
      message: 'You have the latest version of Elastron',
    })
  })

  autoUpdater.on('update-downloaded', async () => {
    await dialog.showMessageBox(window, {
      title: 'Install Updates',
      message: 'Updates downloaded. Application will be restarted.',
    })
    autoUpdater.quitAndInstall()
  })
}

const checkForUpdates = (notify = false) => {
  notifyUpdateNotAvailable = notify
  autoUpdater.checkForUpdates()
}

module.exports = { init, checkForUpdates }
