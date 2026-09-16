import { describe, it, expect, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { server } from './server';

describe('server store module', () => {
	let store;

	beforeEach(() => {
		store = createStoreon([server]);
	});

	it('initializes without a version', () => {
		expect(store.get().server.version).toBe(null);
	});

	it('stores a version number string as-is', () => {
		store.dispatch('server/update', { version: '8.12.0' });
		expect(store.get().server.version).toBe('8.12.0');
	});

	it('unwraps the raw elasticsearch version object', () => {
		store.dispatch('server/update', {
			version: { number: '8.12.0', build_flavor: 'default' },
		});
		expect(store.get().server.version).toBe('8.12.0');
	});

	it('keeps the version when updating other fields', () => {
		store.dispatch('server/update', { version: '8.12.0' });
		store.dispatch('server/update', { cluster: 'test' });
		expect(store.get().server.version).toBe('8.12.0');
	});

	describe('reachability', () => {
		it('starts unreachable with no flavor', () => {
			expect(store.get().server.reachable).toBe(false);
			expect(store.get().server.flavor).toBe(null);
		});

		it('becomes reachable and records the flavor on connected', () => {
			store.dispatch('connected', { version: '9.1.0', flavor: 'serverless' });
			expect(store.get().server.reachable).toBe(true);
			expect(store.get().server.flavor).toBe('serverless');
		});

		it('clears a flavor the cluster does not report', () => {
			store.dispatch('connected', { version: '9.1.0', flavor: 'default' });
			store.dispatch('connected', { version: '8.12.0' });
			expect(store.get().server.flavor).toBe(null);
		});

		it('becomes unreachable on disconnected', () => {
			store.dispatch('connected', { version: '9.1.0' });
			store.dispatch('disconnected');
			expect(store.get().server.reachable).toBe(false);
		});

		it('follows server/reachability both ways', () => {
			store.dispatch('server/reachability', true);
			expect(store.get().server.reachable).toBe(true);
			store.dispatch('server/reachability', false);
			expect(store.get().server.reachable).toBe(false);
		});

		it('does not replace the state when reachability is unchanged', () => {
			store.dispatch('server/reachability', true);
			const before = store.get().server;
			store.dispatch('server/reachability', true);
			expect(store.get().server).toBe(before);
		});

		it('ignores reports about another cluster', () => {
			store.dispatch('server/reachability', true);
			store.on('@init', () => ({}));
			const other = { host: 'http://elsewhere', port: '9200' };
			store.dispatch('server/reachability', { reachable: false, connection: other });
			expect(store.get().server.reachable).toBe(true);
		});

		it('keeps the version when reachability changes', () => {
			store.dispatch('server/update', { version: '8.12.0' });
			store.dispatch('server/reachability', false);
			expect(store.get().server.version).toBe('8.12.0');
		});
	});
});
