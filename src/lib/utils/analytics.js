import { PUBLIC_GA_ID } from '$env/static/public'

/**
 * The only place that talks to Google Analytics. Every export is a no-op
 * unless a measurement ID was baked in at build time and gtag.js has
 * installed its global, so stores and components can call these freely
 * in tests and in builds without analytics.
 *
 * `createAnalytics` exists for tests; the named exports below are the
 * instance bound to the real build-time ID and the real `window.gtag`.
 */
export const createAnalytics = ({
    measurementId = PUBLIC_GA_ID,
    getGtag = () =>
        typeof window !== 'undefined' && typeof window.gtag === 'function'
            ? window.gtag
            : null,
} = {}) => {
    const isAnalyticsEnabled = () => Boolean(measurementId) && getGtag() !== null

    const call = (...args) => {
        if (!isAnalyticsEnabled()) return
        getGtag()(...args)
    }

    const trackPageView = path => call('config', measurementId, { page_path: path })

    const trackEvent = (name, params = {}) => call('event', name, params)

    const setUserProperties = props => call('set', 'user_properties', props)

    return { isAnalyticsEnabled, trackPageView, trackEvent, setUserProperties }
}

export const { isAnalyticsEnabled, trackPageView, trackEvent, setUserProperties } =
    createAnalytics()
