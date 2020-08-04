const { app, BrowserWindow, Menu, ipcMain } = require('electron')

//const Elasticdump = require('elasticdump')
const pkg = require('./package.json')
const { trackEvent } = require('./app/analytics')
const updater = require('./app/updater')
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

ipcMain.on('header-doubleclick', e => {
  if (mainWindow.isMaximized()) {
    mainWindow.setSize(1280, 768, false)
    return mainWindow.center()
  }
  return mainWindow.maximize()
})

const createWindow = () => {
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
      devTools: true,
    },
  })

  trackEvent('App', 'Open', `${process.platform}:${pkg.version}`)

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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const window = createWindow()
  updater.init(window)
  updater.checkForUpdates()
})
