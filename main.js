import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import getPort from 'get-port';
import updater from './updater.js';
import Store from 'electron-store';

const store = new Store({
	encryptionKey: `elastron-${process.platform}-${process.arch}`,
	clearInvalidConfig: true
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lifecycle management for the server process
let serverProcess = null;
let serverPort = null;

const startServer = async () => {
	if (process.env.npm_lifecycle_event === 'dev') {
		return 5173;
	}

	serverPort = await getPort();
	const serverPath = path.join(__dirname, 'build', 'index.js');

	console.log(`Starting SvelteKit server at port ${serverPort}...`);

	serverProcess = fork(serverPath, [], {
		env: {
			...process.env,
			PORT: serverPort,
			HOST: 'localhost',
			ORIGIN: `http://localhost:${serverPort}`,
			ADDRESS_HEADER: 'x-forwarded-for',
			XFF_DEPTH: '1'
		}
	});

	let retries = 0;
	while (retries < 20) {
		try {
			await fetch(`http://localhost:${serverPort}`);
			console.log('Server is ready!');
			return serverPort;
		} catch (e) {
			await new Promise(r => setTimeout(r, 500));
			retries++;
		}
	}
	throw new Error('Server failed to start');
};

const createWindow = (port, routeSuffix = '') => {
	const mainWindow = new BrowserWindow({
		width: 1440,
		height: 960,
		minWidth: 1280,
		minHeight: 768,
		titleBarStyle: 'hiddenInset',
		show: true,
		backgroundColor: '#000',
		webPreferences: {
			nodeIntegration: false, // Security: SvelteKit handles backend
			contextIsolation: true,
			nativeWindowOpen: true,
			devTools: true,
			preload: path.join(__dirname, 'preload.js')
		},
	});

	const url = `http://localhost:${port}${routeSuffix}`;
	mainWindow.loadURL(url);

	mainWindow.webContents.on('new-window', function (e, url) {
		e.preventDefault();
		shell.openExternal(url);
	});

	return mainWindow;
};

let globalHandlersSetup = false;

function setupGlobalHandlers() {
	if (globalHandlersSetup) return;
	globalHandlersSetup = true;

	ipcMain.on('header-doubleclick', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (!win) return;
		if (win.isMaximized()) {
			win.unmaximize();
		} else {
			win.maximize();
		}
	});

	ipcMain.on('check-for-updates', () => {
		console.log('Checking for updates...');
	});

	ipcMain.handle('store:get', (event, key, defaultValue) => {
		return store.get(key, defaultValue);
	});

	ipcMain.on('store:set', (event, key, value) => {
		store.set(key, value);
	});

	ipcMain.on('window:new', (event, routeSuffix) => {
		if (serverPort) {
			createWindow(serverPort, routeSuffix);
		}
	});

	Menu.setApplicationMenu(
		Menu.buildFromTemplate([
			{
				label: app.name,
				submenu: [{ role: 'about' }, { role: 'quit' }],
			},
			{
				role: 'editMenu'
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
						label: 'Check for Updates',
						click: () => {
							updater.checkForUpdates(true)
						}
					},
					{
						label: 'Debug',
						click: () => {
							const win = BrowserWindow.getFocusedWindow();
							if (win) {
								win.webContents.openDevTools();
							}
						}
					}
				]
			}
		])
	);
}

app.whenReady().then(async () => {
	try {
		const port = await startServer();
		setupGlobalHandlers();
		const mainWindow = createWindow(port);
		updater.init(mainWindow);
		updater.checkForUpdates();
	} catch (e) {
		console.error('Failed to start app:', e);
		app.quit();
	}
});

app.on('will-quit', () => {
	if (serverProcess)
		serverProcess.kill();
});
