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
}

export const analytics = createAnalytics()
