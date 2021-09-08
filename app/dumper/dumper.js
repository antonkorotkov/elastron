const ElasticDump = require('elasticdump')
const { dialog } = require('electron')
const { Options } = require('./Options')

// const options = {
//   input: 'http://localhost:9200/my-index',
//   output: `${app.getPath('downloads')}/dump.json`,
//   type: 'mapping',
// }

// const dumper = new ElasticDump(options.input, options.output, options)

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

    console.log(dumperOptions.options)

    const dumper = new ElasticDump(
      dumperOptions.input,
      dumperOptions.output,
      dumperOptions.options
    )

    dumper.on('error', function (error) {
      messaging.send('dumper-error', error)
    })

    dumper.on('log', function (message) {
      console.log('log', message)
    })

    return new Promise((resolve, reject) => {
      dumper.dump(function (error) {
        if (error) reject(error)
        resolve('Ok')
      })
    })
  })
}

module.exports = { init }
