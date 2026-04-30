// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import Nodes from './Nodes.svelte';

// Mock ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
	constructor() {}
	observe() {}
	unobserve() {}
	disconnect() {}
};

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		monitoring: writable({
			nodeStats: {
				timestamps: [1711536600, 1711536610],
				series: {
					'node-1': {
						cpu: [10, 20],
						jvmHeap: [30, 40],
						osMem: [50, 60],
						loadAvg: [0.5, 0.6]
					}
				}
			}
		}),
		dispatch: vi.fn()
	})
}));

// Mock uplot to avoid canvas issues
vi.mock('uplot', () => {
	const MockUPlot = vi.fn(function(opts, data, container) {
		this.root = document.createElement('div');
		if (opts && opts.title) {
			const titleEl = document.createElement('div');
			titleEl.className = 'u-title';
			titleEl.textContent = opts.title;
			this.root.appendChild(titleEl);
		}
		this.over = document.createElement('div');
		this.under = document.createElement('div');
		this.ctx = { canvas: document.createElement('canvas') };
		this.destroy = vi.fn();
		this.setData = vi.fn();
		this.setCursor = vi.fn();
		this.batch = vi.fn((cb) => cb());
		
		if (container) {
			container.appendChild(this.root);
		}
	});
	return { default: MockUPlot };
});

describe('Monitoring Nodes Component', () => {
	it('renders all four monitoring charts', () => {
		render(Nodes);
		expect(screen.getByText('CPU Usage (%)')).toBeTruthy();
		expect(screen.getByText('JVM Heap Usage (%)')).toBeTruthy();
		expect(screen.getByText('OS Memory Usage (%)')).toBeTruthy();
		expect(screen.getByText('Load Average (1m)')).toBeTruthy();
	});
});
