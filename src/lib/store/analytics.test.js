import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { createAnalytics } from './analytics';

vi.mock('$env/static/public', () => ({ PUBLIC_GA_ID: 'G-TEST' }));

describe('analytics store module', () => {
	let store;
	let track;

	beforeEach(() => {
		track = vi.fn();
		store = createStoreon([createAnalytics(track)]);
	});

	it('sends cluster_connected with version and flavor', () => {
		store.dispatch('connected', { version: '8.12.0', flavor: 'default' });
		expect(track).toHaveBeenCalledTimes(1);
		expect(track).toHaveBeenCalledWith('cluster_connected', {
			es_version: '8.12.0',
			es_flavor: 'default',
		});
	});

	it('omits es_flavor when the cluster reports no build flavor', () => {
		store.dispatch('connected', { version: '9.0.1' });
		expect(track).toHaveBeenCalledWith('cluster_connected', { es_version: '9.0.1' });
		expect(track.mock.calls[0][1]).not.toHaveProperty('es_flavor');
	});

	it('sends nothing when connected carries no version', () => {
		store.dispatch('connected', { version: null, flavor: 'default' });
		store.dispatch('connected', {});
		store.dispatch('connected');
		expect(track).not.toHaveBeenCalled();
	});

	it('sends one event per connection', () => {
		store.dispatch('connected', { version: '8.12.0' });
		store.dispatch('connected', { version: '8.12.0' });
		expect(track).toHaveBeenCalledTimes(2);
	});

	it('ignores unrelated events', () => {
		store.dispatch('disconnected');
		store.dispatch('server/update', { version: '8.12.0' });
		expect(track).not.toHaveBeenCalled();
	});
});
