const { app, BrowserWindow, Menu } = require('electron')

const pkg = require('./package.json')
const updater = require('./app/updater')
const messenger = require('./app/ipc-main')
const dumper = require('./app/dumper/dumper')
const elasticProxy = require('./app/requests-node-proxy');

require('@electron/remote/main').initialize()

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
			devTools: true //process.env.ENV === 'development',
		},
	})

	// and load the index.html of the app.
	mainWindow.loadFile('public/index.html')

	// Open the DevTools.
	mainWindow.webContents.openDevTools()

	mainWindow.webContents.on('new-window', function (e, url) {
		e.preventDefault()
		require('electron').shell.openExternal(url)
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
							const { shell } = require('electron')
							await shell.openExternal('https://elastron.eney.solutions')
						},
					},
					{
						label: 'Check For Updates',
						click: () => updater.checkForUpdates(true),
					},
				],
			},
		])
	)

	return mainWindow
}

app.whenReady().then(() => {
	const window = createWindow()
	const messaging = messenger(window)

	require('@electron/remote/main').enable(window.webContents)

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
