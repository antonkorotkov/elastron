import { app, BrowserWindow, Menu, shell } from 'electron'

import updater from './app/updater.js'
import messenger from './app/ipc-main.js'
import dumper from './app/dumper/dumper.js'
import elasticProxy from './app/requests-node-proxy.js'

import electronRemoteMain from '@electron/remote/main/index.js'
electronRemoteMain.initialize()

const createWindow = () => {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 1280,
		height: 768,
		minWidth: 1280,
		minHeight: 768,
		titleBarStyle: 'hiddenInset',
		show: true,
		backgroundColor: '#000',
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			contextIsolation: false,
			nativeWindowOpen: true,
			devTools: true
		},
	})

	// and load the index.html of the app.
	mainWindow.loadFile('public/index.html')

	mainWindow.webContents.on('new-window', function (e, url) {
		e.preventDefault()
		shell.openExternal(url)
	})

	Menu.setApplicationMenu(
		Menu.buildFromTemplate([
			{
				label: app.name,
				submenu: [{ role: 'about' }, { role: 'quit' }],
			},
			{
				label: 'Edit',
				submenu: [
					{ role: 'undo' },
					{ role: 'redo' },
					{ type: 'separator' },
					{ role: 'cut' },
					{ role: 'copy' },
					{ role: 'paste' },
					{ role: 'selectAll' },
				],
			},
			{
				role: 'help',
				submenu: [
					{
						label: 'Learn More',
						click: async () => {
							await shell.openExternal('https://elastron.eney.solutions')
						},
					},
					{
						label: 'Check For Updates',
						click: () => updater.checkForUpdates(true),
					},
					{
						label: 'Debug',
						click: () => {
							mainWindow.webContents.openDevTools()
						}
					}
				],
			},
		])
	)

	return mainWindow
}

app.whenReady().then(() => {
	const window = createWindow()
	const messaging = messenger(window)

	electronRemoteMain.enable(window.webContents)

	updater.init(window)
	updater.checkForUpdates()

	messaging.listen('header-doubleclick', () => {
		if (window.isMaximized()) {
			window.setSize(1280, 768, false)
			return window.center()
		}
		return window.maximize()
	})

	messaging.listen('check-for-updates', () => {
		if (Math.floor(Math.random() * 10) > 7) updater.checkForUpdates()
	})

	dumper.init(messaging, window)
	elasticProxy.init(messaging)
})
