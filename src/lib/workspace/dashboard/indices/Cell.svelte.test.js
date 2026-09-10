// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Cell from './Cell.svelte';

const mocks = vi.hoisted(() => ({
	goto: vi.fn(),
	dispatch: vi.fn(),
	search: null,
}));

vi.mock('$app/navigation', () => ({
	goto: mocks.goto,
}));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	mocks.search = writable({ tabs: [], activeId: 'tab-1' });
	return {
		useStoreon: () => ({
			dispatch: mocks.dispatch,
			search: mocks.search,
		}),
	};
});

const indexCell = name =>
	render(Cell, { cell: name, i: 0, columns: ['index'] });

const actionButtons = container => container.querySelectorAll('.cell-action');

beforeEach(() => {
	Object.assign(navigator, {
		clipboard: {
			writeText: vi.fn().mockResolvedValue(undefined),
		},
	});
	mocks.goto.mockReset();
	mocks.dispatch.mockReset();
	mocks.search.set({ tabs: [], activeId: 'tab-1' });
});

describe('Dashboard Indices Cell', () => {
	it('renders health column as a colored label', () => {
		const { container } = render(Cell, { cell: 'green', i: 0, columns: ['health'] });
		const label = container.querySelector('.label');
		expect(label.className).toContain('green');
	});

	it('renders index column as a link', () => {
		indexCell('my-index');
		const link = screen.getByText('my-index');
		expect(link.tagName).toBe('A');
		expect(link.getAttribute('href')).toBe('/index/my-index');
	});

	it('renders copy and open-in-search buttons after the index name, styled alike', () => {
		const { container } = indexCell('my-index');
		const [copy, open] = actionButtons(container);
		expect(actionButtons(container)).toHaveLength(2);
		expect(copy.querySelector('i').className).toContain('copy outline');
		expect(copy.getAttribute('title')).toBe('Copy index name');
		expect(open.querySelector('i').className).toContain('search');
		expect(open.getAttribute('title')).toBe('Open in search');
		expect(copy.previousElementSibling.tagName).toBe('A');
	});

	it('copies index name to clipboard on click', async () => {
		const { container } = indexCell('my-index');
		const [copy] = actionButtons(container);
		await fireEvent.click(copy);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith('my-index');
	});

	it('opens the index in a search tab and navigates when a tab was opened', async () => {
		mocks.dispatch.mockImplementation((event, payload) => {
			if (event === 'search/tabs/open') {
				mocks.search.set({ tabs: [], activeId: `tab-${payload.index}` });
			}
		});
		const { container } = indexCell('my-index');
		const [, open] = actionButtons(container);

		await fireEvent.click(open);

		expect(mocks.dispatch).toHaveBeenCalledWith('search/tabs/open', { index: 'my-index' });
		expect(mocks.goto).toHaveBeenCalledWith('/search');
	});

	it('stays put when the store did not open a tab', async () => {
		const { container } = indexCell('my-index');
		const [, open] = actionButtons(container);

		await fireEvent.click(open);

		expect(mocks.dispatch).toHaveBeenCalledWith('search/tabs/open', { index: 'my-index' });
		expect(mocks.goto).not.toHaveBeenCalled();
	});

	it('does not follow the index link or bubble the click from either action', async () => {
		const { container } = indexCell('my-index');
		// Svelte delegates `onclick` to the mount container, so a listener that
		// stands in for the row has to sit above it to see propagation stop.
		const row = container.parentElement;
		const onRowClick = vi.fn();
		row.addEventListener('click', onRowClick);

		try {
			for (const button of actionButtons(container)) {
				const click = new MouseEvent('click', { bubbles: true, cancelable: true });
				button.dispatchEvent(click);
				expect(click.defaultPrevented).toBe(true);
			}
			expect(onRowClick).not.toHaveBeenCalled();
		} finally {
			row.removeEventListener('click', onRowClick);
		}
	});

	it('renders other columns as plain text', () => {
		render(Cell, { cell: '123', i: 0, columns: ['docs.count'] });
		expect(screen.getByText('123')).toBeTruthy();
	});
});
