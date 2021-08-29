const { app, BrowserWindow, Menu } = require('electron')

const pkg = require('./package.json')
const { trackEvent } = require('./app/analytics')
const updater = require('./app/updater')
const messanger = require('./app/ipc-main')
const dumper = require('./app/dumper')

global['trackEvent'] = trackEvent

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
      devTools: process.env.ENV === 'development',
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
            label: 'Become a Patron 💛',
            click: async () => {
              const { shell } = require('electron')
              await shell.openExternal(
                'https://www.patreon.com/bePatron?u=60793577'
              )
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
  const messaging = messanger(window)

  updater.init(window)
  updater.checkForUpdates()

  messaging.listen('header-doubleclick', () => {
    if (window.isMaximized()) {
      window.setSize(1280, 768, false)
      return window.center()
    }
    return window.maximize()
  })

  dumper.init(messaging)
})
