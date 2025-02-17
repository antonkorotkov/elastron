import electronUpdater from 'electron-updater'
import { dialog } from 'electron'

const { autoUpdater } = electronUpdater

autoUpdater.autoDownload = false

let notifyUpdateNotAvailable = false

const init = window => {
	autoUpdater.on('error', async e => {
		await dialog.showMessageBox(window, {
			type: 'error',
			title: 'Oops...',
			message: `Could not automatically update the app because: ${e.message || 'unknown error'}. Please, consider downloading the new version from https://github.com/antonkorotkov/elastron/releases/latest`,
		})
	})

	autoUpdater.setFeedURL({
		host: null,
		provider: 'github',
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

export default { init, checkForUpdates }
