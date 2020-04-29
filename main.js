// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')

ipcMain.on('online-status-changed', (event, status) => {
  console.log(status)
})

autoUpdater.setFeedURL({
  provider: 'github',
  token: '0414f1ae0f8265c966504422256f5f43185dffc6',
  owner: 'antonkorotkov',
  repo: 'elastron',
})

autoUpdater.on('error', e => {
  dialog.showErrorBox(
    'Update Error',
    'Could not update application. Please contact me at antonkorotkoff@gmail.com'
  )
})

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    minWidth: 1280,
    minHeight: 768,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      devTools: true,
    },
  })

  autoUpdater.on('update-available', async () => {
    const answer = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Found Updates',
      message:
        'The new version of Elastron is available, do you want update now?',
      buttons: ['Yeah', 'Nope'],
    })

    if (answer.response === 0) autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-downloaded', async () => {
    await dialog.showMessageBox(mainWindow, {
      title: 'Install Updates',
      message: 'Updates downloaded, application will be quit for update...',
    })
    autoUpdater.quitAndInstall()
  })

  autoUpdater.checkForUpdates()

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
              await shell.openExternal(
                'https://github.com/antonkorotkov/elastron'
              )
            },
          },
        ],
      },
    ])
  )
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow)
