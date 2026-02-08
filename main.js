import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import getPort from 'get-port';
import axios from 'axios';
import updater from './updater.js';

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
			await axios.get(`http://localhost:${serverPort}`);
			console.log('Server is ready!');
			return serverPort;
		} catch (e) {
			await new Promise(r => setTimeout(r, 500));
			retries++;
		}
	}
	throw new Error('Server failed to start');
};

const createWindow = (port) => {
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

	ipcMain.on('header-doubleclick', () => {
		if (mainWindow.isMaximized()) {
			mainWindow.unmaximize();
		} else {
			mainWindow.maximize();
		}
	});

	ipcMain.on('check-for-updates', () => {
		// checks for updates - to be implemented with electron-updater
		// For now, prompt user or log
		console.log('Checking for updates...');
	});

	// ... rest of createWindow


	const url = `http://localhost:${port}`;
	mainWindow.loadURL(url);

	mainWindow.webContents.on('new-window', function (e, url) {
		e.preventDefault();
		shell.openExternal(url);
	});

	// ... Menu setup (kept similar to original) ...
	// Simplified Menu for brevity, can restore full menu if needed
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
							mainWindow.webContents.openDevTools()
						}
					}
				]
			}
		])
	);

	return mainWindow;
};

app.whenReady().then(async () => {
	try {
		const port = await startServer();
		const mainWindow = createWindow(port);
		updater.init(mainWindow);
		updater.checkForUpdates();
	} catch (e) {
		console.error('Failed to start app:', e);
		app.quit();
	}
});

app.on('will-quit', () => {
	if (serverProcess) {
		serverProcess.kill();
	}
});
