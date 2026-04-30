// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConnectDialog from './ConnectDialog.svelte';
import { writable } from 'svelte/store';

const mockDispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({ name: 'current' }),
		history: writable({
			connection: [
				{ name: 'Server A', host: 'http://server-a', port: '9200', useAuth: false },
				{ name: 'Server B', host: 'http://server-b', port: '9200', useAuth: false }
			]
		}),
		dispatch: mockDispatch,
	})
}));

describe('ConnectDialog', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
    });

	it('renders saved connections tab by default', () => {
		render(ConnectDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });
		expect(screen.getByText('Saved Connections')).toBeTruthy();
		expect(screen.getByText('Quick Connect')).toBeTruthy();
        
        // It should contain the options Server A and Server B
        expect(screen.getByText('Server A')).toBeTruthy();
        expect(screen.getByText('Server B')).toBeTruthy();
	});

    it('can switch to quick connect tab', async () => {
		render(ConnectDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });
        
        const quickConnectTab = screen.getByText('Quick Connect');
        await fireEvent.click(quickConnectTab);

        // It should now show the Host and Port inputs
        expect(screen.getByLabelText('Host')).toBeTruthy();
        expect(screen.getByLabelText('Port')).toBeTruthy();
    });

	it('opens selected connection in new window', async () => {
		window.electron = { ipcRenderer: { send: vi.fn() } };
		const closeMock = vi.fn();
		const { getByRole, getByText } = render(ConnectDialog, { context: new Map([['modal-window', { close: closeMock, open: vi.fn() }]]) });
		
		// Wait for select and change it to the second item (index 1)
		const select = getByRole('combobox');
		await fireEvent.change(select, { target: { value: '1' } });
		
		const openNewWindowBtn = getByText('Open in New Window');
		await fireEvent.click(openNewWindowBtn);
		
		expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith('window:new', '?connectionIndex=1');
		expect(closeMock).toHaveBeenCalled();
	});
});
