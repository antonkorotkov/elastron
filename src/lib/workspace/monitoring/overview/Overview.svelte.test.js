// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import Overview from './Overview.svelte';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		monitoring: writable({
			clusterHealth: { status: 'green', cluster_name: 'test-cluster' },
			clusterStats: {
				nodes: { count: { total: 3 } },
				indices: { count: 10, docs: { count: 1000 } }
			},
			nodeStats: { timestamps: [], series: {} }
		}),
		dispatch: vi.fn()
	})
}));

describe('Monitoring Overview Component', () => {
	it('renders cluster status cards', () => {
		render(Overview);
		expect(screen.getByText('test-cluster')).toBeTruthy();
		expect(screen.getByText(/GREEN HEALTH/i)).toBeTruthy();
		expect(screen.getByText('Nodes')).toBeTruthy();
		expect(screen.getByText('Active Shards')).toBeTruthy();
		expect(screen.getByText('Indices')).toBeTruthy();
		expect(screen.getByText('Documents')).toBeTruthy();
	});
});
