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
		serverPort = 5173;
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

// Open windows, in the order they were created (drives the Window menu list)
const openWindows = [];

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
			devTools: true,
			preload: path.join(__dirname, 'preload.js')
		},
	});

	const url = `http://localhost:${port}${routeSuffix}`;
	mainWindow.loadURL(url);

	mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
		if (/^https?:$/.test(new URL(targetUrl).protocol)) {
			shell.openExternal(targetUrl);
		}
		return { action: 'deny' };
	});

	mainWindow.webContents.on('will-navigate', (e, targetUrl) => {
		if (new URL(targetUrl).origin !== `http://localhost:${port}`) {
			e.preventDefault();
			shell.openExternal(targetUrl);
		}
	});

	openWindows.push(mainWindow);

	// Keep the Window menu in sync with what is actually open, focused and titled
	mainWindow.on('closed', () => {
		const index = openWindows.indexOf(mainWindow);
		if (index >= 0) openWindows.splice(index, 1);
		buildApplicationMenu();
	});
	mainWindow.on('focus', buildApplicationMenu);
	// The title is applied right after this event, so rebuild on the next tick
	mainWindow.webContents.on('page-title-updated', () => {
		setImmediate(buildApplicationMenu);
	});

	buildApplicationMenu();

	return mainWindow;
};

const focusWindow = (win) => {
	if (win.isMinimized()) win.restore();
	win.show();
	win.focus();
};

const buildWindowMenuItems = () => {
	const items = [
		{ role: 'minimize' },
		{ role: 'zoom' },
		{ type: 'separator' },
		{ role: 'close' }
	];

	if (process.platform === 'darwin') {
		items.push({ type: 'separator' }, { role: 'front' });
	}

	if (openWindows.length) {
		items.push({ type: 'separator' });

		// Windows on the same connection share a title — number the duplicates
		const seen = new Map();
		openWindows.forEach((win, index) => {
			const title = win.getTitle() || `Window ${index + 1}`;
			const count = (seen.get(title) ?? 0) + 1;
			seen.set(title, count);

			items.push({
				label: count > 1 ? `${title} (${count})` : title,
				type: 'checkbox',
				checked: win.isFocused(),
				accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
				click: () => focusWindow(win)
			});
		});
	}

	return items;
};

function buildApplicationMenu() {
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
				label: 'Window',
				submenu: buildWindowMenuItems()
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
		updater.checkForUpdates();
	});

	ipcMain.on('restart-and-install', () => {
		updater.restartAndInstall();
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

	buildApplicationMenu();
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
