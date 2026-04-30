// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ManageConnectionsDialog from './ManageConnectionsDialog.svelte';
import { writable } from 'svelte/store';

const mockDispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		history: writable({
			connection: [
				{ name: 'Local Test', host: 'http://localhost', port: '9200', useAuth: false, headers: [], useSshTunnel: false, ssh: { host: '', port: '22', username: '', authMethod: 'password', password: '', privateKeyContent: '', privateKeyName: '', passphrase: '' } }
			]
		}),
		dispatch: mockDispatch,
	})
}));

describe('ManageConnectionsDialog', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
    });

	it('renders sidebar with saved connections', () => {
		render(ManageConnectionsDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });
		expect(screen.getByText('Manage Connections')).toBeTruthy();
		expect(screen.getByText('Local Test')).toBeTruthy();
        expect(screen.getByText('Add New')).toBeTruthy();
	});

    it('shows connection details in form', () => {
		render(ManageConnectionsDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });
        
        // Form fields should be populated from the first selected connection "Local Test"
        const nameInput = screen.getByLabelText('Name');
        expect(nameInput.value).toBe('Local Test');

        const hostInput = screen.getByLabelText('Host');
        expect(hostInput.value).toBe('http://localhost');
    });

    it('switches to new connection form when Add New is clicked', async () => {
		render(ManageConnectionsDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });
        
        const addNewBtn = screen.getByText('Add New');
        await fireEvent.click(addNewBtn);

        const nameInput = screen.getByLabelText('Name');
        expect(nameInput.value).toBe('New Connection');
    });
});
