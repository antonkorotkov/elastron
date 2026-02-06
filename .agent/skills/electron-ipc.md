---
name: electron-ipc-development
description: Guidelines for implementing IPC communication between Main and Renderer processes in Elastron
---

# Electron IPC Development

Elastron uses a custom wrapper for IPC communication to ensure security and consistency.

## Renderer Process (Frontend)
**DO NOT** import `ipcRenderer` directly from `electron`.
Use `src/api/ipc-renderer.js`.

### Supported Methods
- `send(channel, ...args)`: Fire and forget.
- `listen(channel, callback)`: Listen for messages from Main.
- `run(channel, ...args)`: Invoke a handler in Main and await the result (Promise).

### Example
```javascript
import ipc from '../api/ipc-renderer'

// Request data
const data = await ipc.run('data-request', { id: 1 })

// Send command
ipc.send('do-something', { forceful: true })
```

## Main Process (Backend)
IPC handlers are set up in `app/ipc-main.js` or specialized modules like `app/requests-node-proxy.js`.

### Registering Handlers
The `messenger` function in `app/ipc-main.js` wraps `ipcMain`.

```javascript
// app/ipc-main.js
module.exports = (window) => {
    const ipc = require('electron').ipcMain

    return {
        listen: (channel, callback) => {
             ipc.on(channel, (event, ...args) => {
                 callback(...args)
             })
        },
        // ...
    }
}
```

### Adding New Handlers
To add a new handler, extend the `messenger` content or the module where it's used.
If you need to return data to the renderer, check `ipc.handle` usage in `app/requests-node-proxy.js` as `run` on renderer corresponds to `invoke`.

**Important**: The current implementation of `app/ipc-main.js` might need extension to support `handle/invoke` if not already present. Check `app/requests-node-proxy.js` for how `ipcMain.handle` is used.
