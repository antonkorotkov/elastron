import ElasticDump from 'elasticdump'
import { dialog } from 'electron'
import { Options } from './Options.js'
import get from 'lodash/get.js'
import isArray from 'lodash/isArray.js'

// eslint-disable-next-line no-undef
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// eslint-disable-next-line no-undef
const logError = console.error

const init = (messaging, win) => {
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
		try {
			// eslint-disable-next-line no-undef
			console.error = error => {
				if (get(error, 'error.reason'))
					messaging.send('dumper-error', get(error, 'error.reason'))
			}

			const dumperOptions = new Options(options)
			const dumper = new ElasticDump(dumperOptions.options)

			dumper.on('error', error => {
				try {
					if (!error)
						return messaging.send('dumper-error', 'Unknown error occurred')

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
					console.error = logError
					if (error) {
						return reject(false)
					}
					return resolve(true)
				})
			})
		} catch (e) {
			console.error = logError
			const message = get(e, 'message', 'Error occured in main process')
			messaging.send('dumper-error', message)
		}
	})
}

export default { init }
