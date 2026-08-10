// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchTab from './Search.svelte';
import { writable } from 'svelte/store';

const dispatch = vi.fn();

const searchStore = writable({
	type: 'body',
	view: 'hits',
	index: '_all',
	requestBody: {},
	results: {},
	stats: { total_results: 0, time: 0 },
	loading: false
});

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: searchStore,
		indices: writable({ data: [['idx', 'yellow', 'open']], columns: ['index', 'health', 'status'] }),
		connection: writable({}),
		server: writable({ version: { number: '8.0.0' } }),
		dispatch
	})
}));

const instances = [];

vi.mock('jsoneditor', () => {
	class FakeEditor {
		constructor(container, options, json) {
			this.options = options;
			this.text = JSON.stringify(json ?? {});
			this.mode = options.mode;
			this.destroy = vi.fn();
			this.set = vi.fn(json => {
				this.text = JSON.stringify(json);
			});
			this.update = vi.fn();
			instances.push(this);
		}
		getText() {
			return this.text;
		}
		get() {
			return JSON.parse(this.text);
		}
		getMode() {
			return this.mode;
		}
		setMode(mode) {
			this.mode = mode;
		}
		/** Simulate the user typing in the request body editor. */
		type(text) {
			this.text = text;
			this.options.onChange?.();
		}
	}
	return { default: FakeEditor };
});

vi.mock('jsoneditor/dist/jsoneditor.min.css', () => ({}));

const renderSearch = async () => {
	instances.length = 0;
	const result = render(SearchTab);
	// the editors are created from a dynamic import in onMount
	for (let i = 0; i < 20 && instances.length === 0; i++) await tick();
	await tick();
	return { ...result, qEditor: instances[0] };
};

const runClick = () => fireEvent.click(screen.getAllByText('Run')[0]);

describe('Search Tab', () => {
	beforeEach(() => {
		dispatch.mockClear();
	});

	it('renders correctly', async () => {
		const { container } = await renderSearch();
		expect(container).toBeTruthy();
	});

	it('does not run a query with a malformed request body', async () => {
		const { qEditor } = await renderSearch();
		qEditor.type('{"query":');
		await tick();

		await runClick();

		expect(dispatch).toHaveBeenCalledWith(
			'notification/add',
			expect.objectContaining({ type: 'error' })
		);
		expect(dispatch).not.toHaveBeenCalledWith('search/run');
	});

	it('runs the query with the body currently in the editor', async () => {
		const { qEditor } = await renderSearch();
		qEditor.type('{"query":{"match_all":{}}}');
		await tick();

		await runClick();

		expect(dispatch).toHaveBeenCalledWith('search/update', {
			requestBody: { query: { match_all: {} } }
		});
		expect(dispatch).toHaveBeenCalledWith('search/run');
	});

	it('reports a malformed body instead of throwing when toggling profiling', async () => {
		const { qEditor } = await renderSearch();
		qEditor.type('{"query":');
		await tick();

		await fireEvent.click(screen.getByLabelText('Profiling'));

		expect(dispatch).toHaveBeenCalledWith(
			'notification/add',
			expect.objectContaining({ type: 'error' })
		);
	});
});
