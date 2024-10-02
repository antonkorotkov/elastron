const { ipcMain } = require('electron')

class MessagingAPI {
    constructor(mainWindow) {
        this.window = mainWindow
    }

    listen(eventName, callbackFunction) {
        ipcMain.on(eventName, callbackFunction)
    }

    send(eventName, ...messageData) {
        this.window.webContents.send(eventName, ...messageData)
    }

    respond(eventName, callbackFunction) {
        ipcMain.handle(eventName, callbackFunction)
    }
}

const init = mainWindow => {
    return new MessagingAPI(mainWindow)
}

module.exports = init
