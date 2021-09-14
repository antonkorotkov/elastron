const ElasticDump = require('elasticdump')
const { dialog } = require('electron')
const { Options } = require('./Options')
const get = require('lodash/get')
const isArray = require('lodash/isArray')

const init = (messaging, win) => {
  console.log('Dumper Initialized')

  messaging.respond('select-file', async (__, { extensions }) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Files', extensions }],
    })
    return result
  })

  messaging.respond('select-dir', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    })
    return result
  })

  messaging.respond('import-export-run', (__, options) => {
    console.log('Import Export Run command received')

    const dumperOptions = new Options(options)
    const dumper = new ElasticDump(dumperOptions.options)

    dumper.on('error', error => {
      try {
        if (!error)
          return messaging.send('dumper-error', 'Unknown error occured')

        if (error.message) {
          const message = JSON.parse(error.message)
          messaging.send(
            'dumper-error',
            get(message, 'error.reason', error.message)
          )
        }

        if (error.errors && isArray(error.errors)) {
          for (let e of error.errors) {
            messaging.send('dumper-error', e)
          }
        }
      } catch (e) {
        messaging.send('dumper-error', error.message)
      }
    })
    dumper.on('log', message => messaging.send('dumper-log', message))
    dumper.on('debug', message => messaging.send('dumper-debug', message))

    return new Promise((resolve, reject) => {
      dumper.dump(function (error) {
        if (error) return reject(false)
        return resolve(true)
      })
    })
  })
}

module.exports = { init }
