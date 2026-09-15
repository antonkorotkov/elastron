import { trackEvent } from '../utils/analytics'

/**
 * Reports usage to Google Analytics. Holds no state of its own; it only
 * listens. `track` is injectable so the module can be tested without gtag.
 */
export const createAnalytics = (track = trackEvent) => store => {
	store.on('connected', (state, payload) => {
		const version = payload?.version
		if (!version) return

		const flavor = payload?.flavor

		track('cluster_connected', {
			es_version: version,
			...(flavor ? { es_flavor: flavor } : {}),
		})
	})

	// Assistant usage: only that a message was sent and its reply arrived.
	// No content, tool, provider, or model details are ever attached.
	store.on('assistant/messageSent', () => {
		track('assistant_message_sent')
	})

	store.on('assistant/responseReceived', () => {
		track('assistant_response_received')
	})
}

export const analytics = createAnalytics()
