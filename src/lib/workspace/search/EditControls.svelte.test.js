// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import EditControls from './EditControls.svelte';

const dispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({ dispatch })
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ open: vi.fn() })
}));

const TAB = 'tab-1';

const tab = {
	id: TAB,
	loading: false,
	editDoc: { _type: 'doc', _id: '1', _index: 'idx' }
};

describe('EditControls', () => {
	beforeEach(() => {
		dispatch.mockClear();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
	});

	it('renders correctly', () => {
		const { container } = render(EditControls, { tab, canEditDoc: true, rEditor: {} });
		expect(container).toBeTruthy();
		expect(screen.getByText('doc:1')).toBeTruthy();
	});

	it('updates the document against its tab', async () => {
		const user = userEvent.setup();
		const rEditor = { get: () => ({ a: 1 }) };
		render(EditControls, { tab, canEditDoc: true, rEditor });

		await user.click(screen.getByRole('button', { name: 'Update' }));

		expect(dispatch).toHaveBeenCalledWith('search/documents/update', {
			id: TAB,
			data: { a: 1 }
		});
	});

	it('reindexes the document against its tab', async () => {
		const user = userEvent.setup();
		const rEditor = { get: () => ({ a: 2 }) };
		render(EditControls, { tab, canEditDoc: true, rEditor });

		await user.click(screen.getByRole('button', { name: 'Reindex' }));

		expect(dispatch).toHaveBeenCalledWith('search/documents/reindex', {
			id: TAB,
			data: { a: 2 }
		});
	});

	it('cancels back to the hits view of its tab', async () => {
		const user = userEvent.setup();
		render(EditControls, { tab, canEditDoc: false, rEditor: {} });

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(dispatch).toHaveBeenCalledWith('search/update', {
			id: TAB,
			patch: { view: 'hits' }
		});
	});
});
