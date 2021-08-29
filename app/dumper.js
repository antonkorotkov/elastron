const ElasticDump = require('elasticdump')

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

const init = messaging => {
  console.log('Dumper Initialized')

  messaging.respond('import-export-run', async e => {
    console.log('Import Export Run command received')

    return new Promise((resolve, reject) => {
      let k = 5
      let i = setInterval(() => {
        console.log('Response in', k--, 'seconds')
      }, 1000)
      setTimeout(() => {
        clearInterval(i)
        resolve('Response!')
      }, 5000)
    })
  })
}

module.exports = { init }
