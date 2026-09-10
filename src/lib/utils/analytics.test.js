import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	createAnalytics,
	isAnalyticsEnabled,
	trackPageView,
	trackEvent,
	setUserProperties,
} from './analytics';

vi.mock('$env/static/public', () => ({ PUBLIC_GA_ID: 'G-TEST' }));

describe('analytics wrapper', () => {
	describe('createAnalytics', () => {
		it('is disabled and silent when gtag is not installed', () => {
			const analytics = createAnalytics({ measurementId: 'G-X', getGtag: () => null });
			expect(analytics.isAnalyticsEnabled()).toBe(false);
			expect(() => {
				analytics.trackPageView('/search');
				analytics.trackEvent('cluster_connected', { es_version: '8.12.0' });
				analytics.setUserProperties({ app_version: '1.0.0' });
			}).not.toThrow();
		});

		it('is disabled and silent when no measurement ID was configured', () => {
			const gtag = vi.fn();
			const analytics = createAnalytics({ measurementId: '', getGtag: () => gtag });
			expect(analytics.isAnalyticsEnabled()).toBe(false);
			analytics.trackPageView('/search');
			analytics.trackEvent('cluster_connected', { es_version: '8.12.0' });
			analytics.setUserProperties({ app_version: '1.0.0' });
			expect(gtag).not.toHaveBeenCalled();
		});

		it('is enabled when both an ID and gtag are present', () => {
			const analytics = createAnalytics({ measurementId: 'G-X', getGtag: () => vi.fn() });
			expect(analytics.isAnalyticsEnabled()).toBe(true);
		});

		it('sends a page view as a config call on the measurement ID', () => {
			const gtag = vi.fn();
			const analytics = createAnalytics({ measurementId: 'G-X', getGtag: () => gtag });
			analytics.trackPageView('/monitoring');
			expect(gtag).toHaveBeenCalledTimes(1);
			expect(gtag).toHaveBeenCalledWith('config', 'G-X', { page_path: '/monitoring' });
		});

		it('sends an event with its parameters', () => {
			const gtag = vi.fn();
			const analytics = createAnalytics({ measurementId: 'G-X', getGtag: () => gtag });
			analytics.trackEvent('cluster_connected', { es_version: '8.12.0', es_flavor: 'default' });
			expect(gtag).toHaveBeenCalledWith('event', 'cluster_connected', {
				es_version: '8.12.0',
				es_flavor: 'default',
			});
		});

		it('sends an event with empty parameters when none are given', () => {
			const gtag = vi.fn();
			const analytics = createAnalytics({ measurementId: 'G-X', getGtag: () => gtag });
			analytics.trackEvent('something');
			expect(gtag).toHaveBeenCalledWith('event', 'something', {});
		});

		it('sets user properties', () => {
			const gtag = vi.fn();
			const analytics = createAnalytics({ measurementId: 'G-X', getGtag: () => gtag });
			analytics.setUserProperties({ app_version: '2.2.2' });
			expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { app_version: '2.2.2' });
		});
	});

	describe('default instance', () => {
		const originalWindow = globalThis.window;

		beforeEach(() => {
			globalThis.window = { gtag: vi.fn() };
		});

		afterEach(() => {
			globalThis.window = originalWindow;
		});

		it('uses the build-time measurement ID and window.gtag', () => {
			expect(isAnalyticsEnabled()).toBe(true);
			trackPageView('/');
			trackEvent('cluster_connected', { es_version: '9.0.0' });
			setUserProperties({ app_version: '2.2.2' });
			expect(window.gtag.mock.calls).toEqual([
				['config', 'G-TEST', { page_path: '/' }],
				['event', 'cluster_connected', { es_version: '9.0.0' }],
				['set', 'user_properties', { app_version: '2.2.2' }],
			]);
		});

		it('is silent when window.gtag is missing', () => {
			globalThis.window = {};
			expect(isAnalyticsEnabled()).toBe(false);
			expect(() => trackPageView('/')).not.toThrow();
		});

		it('is silent when window is undefined', () => {
			globalThis.window = undefined;
			expect(isAnalyticsEnabled()).toBe(false);
			expect(() => trackEvent('x')).not.toThrow();
		});
	});
});
