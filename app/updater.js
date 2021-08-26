const { autoUpdater } = require('electron-updater')

const { trackEvent } = require('./analytics')
const pkg = require('../package.json')
const { dialog } = require('electron')

autoUpdater.autoDownload = false

let notifyUpdateNotAvailable = false

const init = window => {
  autoUpdater.on('error', e => {
    trackEvent('Error', 'Update', e.message || 'no message')
  })

  autoUpdater.setFeedURL({
    provider: 'github',
    token: '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',
    owner: 'antonkorotkov',
    repo: 'elastron',
  })

  autoUpdater.on('update-available', async () => {
    trackEvent('App', 'Update Available', `${process.platform}:${pkg.version}`)

    const answer = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Found Updates',
      message: 'The new version of Elastron is available.',
      buttons: ['Download Silently', 'Later'],
    })

    if (answer.response === 0) autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-not-available', async () => {
    trackEvent(
      'App',
      'Update Not Available',
      `${process.platform}:${pkg.version}`
    )

    if (!notifyUpdateNotAvailable) return

    await dialog.showMessageBox(window, {
      title: 'Updates Not Available',
      message: 'You have the latest version of Elastron',
    })
  })

  autoUpdater.on('update-downloaded', async () => {
    trackEvent('App', 'Update Downloaded', `${process.platform}:${pkg.version}`)

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
  trackEvent('App', 'Update Check', `${process.platform}:${pkg.version}`)
}

module.exports = { init, checkForUpdates }
