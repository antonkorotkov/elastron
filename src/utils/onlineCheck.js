const onOnline = callback => {
	const _online = () => {
		if (typeof callback === 'function') {
			callback(navigator.onLine)
		}
	}
	window.removeEventListener('online', _online)
	window.addEventListener('online', _online)
}

const onOffline = callback => {
	const _offline = () => {
		if (typeof callback === 'function') {
			callback(navigator.onLine)
		}
	}
	window.removeEventListener('offline', _offline)
	window.addEventListener('offline', _offline)
}

const isOnline = navigator.onLine

export default { onOnline, onOffline, isOnline }
