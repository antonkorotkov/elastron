import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import { dialog } from 'electron'

let notifyUpdateNotAvailable = false

const init = window => {
	autoUpdater.autoDownload = false

	autoUpdater.on('error', async (error) => {
		console.error('Update error:', error)
		// Only show error dialog if we were explicitly checking for updates
		if (notifyUpdateNotAvailable) {
			await dialog.showMessageBox(window, {
				type: 'error',
				title: 'Update Error',
				message: 'Update error: ' + (error.message || error),
			})
		}
	})

	autoUpdater.on('update-available', async () => {
		const answer = await dialog.showMessageBox(window, {
			type: 'info',
			title: 'Found Updates',
			message: 'The new version of Elastron is available.',
			buttons: ['Download', 'Later'],
			defaultId: 0,
			cancelId: 1
		})

		if (answer.response === 0) {
			window.webContents.send('update_available')
			autoUpdater.downloadUpdate()
		}
	})

	autoUpdater.on('download-progress', progress => {
		window.webContents.send('update-download-progress', { percent: progress.percent })
	})

	autoUpdater.on('update-not-available', async () => {
		if (!notifyUpdateNotAvailable) return

		await dialog.showMessageBox(window, {
			type: 'info',
			title: 'No Updates',
			message: 'You have the latest version of Elastron.',
		})
	})

	autoUpdater.on('update-downloaded', async () => {
		window.webContents.send('update_downloaded')

		const answer = await dialog.showMessageBox(window, {
			type: 'info',
			title: 'Install Updates',
			message: 'Updates downloaded. Application will be restarted to install.',
			buttons: ['Restart and Install', 'Later'],
			defaultId: 0,
			cancelId: 1
		})

		if (answer.response === 0) {
			autoUpdater.quitAndInstall()
		}
	})
}

const checkForUpdates = (notify = false) => {
	notifyUpdateNotAvailable = notify
	autoUpdater.checkForUpdates().catch(err => {
		console.error('Failed to check for updates:', err)
		if (notify) {
			dialog.showErrorBox('Update Check Failed', 'Failed to check for updates: ' + err.message)
		}
	})
}

const restartAndInstall = () => {
	autoUpdater.quitAndInstall()
}

export default { init, checkForUpdates, restartAndInstall }
