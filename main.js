const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const pkg = require('./package.json')

//const Elasticdump = require('elasticdump')
const { trackEvent } = require('./app/analytics')
global['trackEvent'] = trackEvent

// const options = {
//   input: 'http://localhost:9200/my-index',
//   output: `${app.getPath('downloads')}/dump.json`,
//   type: 'mapping',
// }

// const dumper = new Elasticdump(options.input, options.output, options)

// dumper.on('log', function (message) {
//   console.log('log', message)
// })
// dumper.on('debug', function (message) {
//   console.log('debug', message)
// })
// dumper.on('error', function (error) {
//   console.log(
//     'error',
//     `Error Emitted => ${error.message || JSON.stringify(error)}`
//   )
// })

// dumper.dump(function (error) {
//   console.log(arguments)
//   if (error) {
//     process.exit(1)
//   }
// })

let mainWindow

autoUpdater.on('error', e => {
  trackEvent('Error', 'Update', e.message || 'no message')
  console.log('Error', e)
})

autoUpdater.setFeedURL({
  provider: 'github',
  token: '0414f1ae0f8265c966504422256f5f43185dffc6',
  owner: 'antonkorotkov',
  repo: 'elastron',
})

ipcMain.on('online-status-changed', (event, online) => {
  if (online) {
    autoUpdater.checkForUpdates()
    trackEvent('App', 'Update Check', `${process.platform}:${pkg.version}`)
  }
})

ipcMain.on('header-doubleclick', e => {
  if (mainWindow.isMaximized()) {
    mainWindow.setSize(1280, 768, false)
    return mainWindow.center()
  }
  return mainWindow.maximize()
})

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    minWidth: 1280,
    minHeight: 768,
    titleBarStyle: 'hiddenInset',
    show: true,
    backgroundColor: '#000',
    webPreferences: {
      nodeIntegration: true,
      devTools: false,
    },
  })

  trackEvent('App', 'Open', `${process.platform}:${pkg.version}`)

  autoUpdater.on('update-available', async () => {
    trackEvent('App', 'Update Available', `${process.platform}:${pkg.version}`)

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
    trackEvent('App', 'Update Downloaded', `${process.platform}:${pkg.version}`)

    await dialog.showMessageBox(mainWindow, {
      title: 'Install Updates',
      message: 'Updates downloaded, application will be quit for update...',
    })
    autoUpdater.quitAndInstall()
  })

  // and load the index.html of the app.
  mainWindow.loadFile('public/index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  mainWindow.webContents.on('new-window', function (e, url) {
    e.preventDefault()
    trackEvent('App', 'Open Link', url)
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
              await shell.openExternal('https://github.com/antonkorotkov')
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
