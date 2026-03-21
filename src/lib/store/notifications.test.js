import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { notifications } from './notifications';

// Mock randomId to produce predictable values
vi.mock('../utils/helpers', () => {
	let counter = 0;
	return {
		randomId: () => `id-${++counter}`,
	};
});

describe('notifications store module', () => {
	let store;

	beforeEach(() => {
		store = createStoreon([notifications]);
	});

	it('initializes with empty notifications', () => {
		expect(store.get().notifications).toEqual([]);
	});

	it('adds a notification', () => {
		store.dispatch('notification/add', {
			type: 'success',
			message: 'Connected',
		});
		const notifs = store.get().notifications;
		expect(notifs).toHaveLength(1);
		expect(notifs[0].type).toBe('success');
		expect(notifs[0].message).toBe('Connected');
		expect(notifs[0].id).toBeDefined();
	});

	it('prevents duplicate notifications', () => {
		store.dispatch('notification/add', {
			type: 'error',
			message: 'Fail',
		});
		store.dispatch('notification/add', {
			type: 'error',
			message: 'Fail',
		});
		expect(store.get().notifications).toHaveLength(1);
	});

	it('allows different notifications with same type', () => {
		store.dispatch('notification/add', {
			type: 'error',
			message: 'Error 1',
		});
		store.dispatch('notification/add', {
			type: 'error',
			message: 'Error 2',
		});
		expect(store.get().notifications).toHaveLength(2);
	});

	it('deletes a notification by id', () => {
		store.dispatch('notification/add', { type: 'info', message: 'Test' });
		const id = store.get().notifications[0].id;
		store.dispatch('notification/delete', id);
		expect(store.get().notifications).toHaveLength(0);
	});

	it('shifts the first notification', () => {
		store.dispatch('notification/add', {
			type: 'info',
			message: 'First',
		});
		store.dispatch('notification/add', {
			type: 'info',
			message: 'Second',
		});
		store.dispatch('notification/shift');
		const notifs = store.get().notifications;
		expect(notifs).toHaveLength(1);
		expect(notifs[0].message).toBe('Second');
	});
});
