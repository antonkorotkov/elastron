// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConnectDialog from './ConnectDialog.svelte';

const mockDispatch = vi.fn();

const stores = vi.hoisted(() => ({ connections: null }));
const api = vi.hoisted(() => ({ testResult: { success: false, message: 'unreachable' } }));

vi.mock('../../../api/elasticsearch', () => ({
	default: class {
		async test() {
			return api.testResult;
		}
	},
	openTunnel: vi.fn(async () => ({})),
	closeTunnel: vi.fn(async () => ({})),
}));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	stores.connections = writable({
		connection: [
			{ name: 'Server A', host: 'http://server-a', port: '9200', useAuth: false },
			{ name: 'Server B', host: 'http://server-b', port: '9200', useAuth: false }
		]
	});
	return {
		useStoreon: () => ({
			app: writable({ theme: 'light' }),
			connection: writable({ name: 'current' }),
			connections: stores.connections,
			dispatch: mockDispatch,
		})
	};
});

describe('ConnectDialog', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
        api.testResult = { success: false, message: 'unreachable' };
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

	it('clears the color when quick connecting', async () => {
		// connection/update merges over the previous connection, so a quick
		// connect that omitted `color` would inherit the color of whatever
		// cluster was connected before it — painting a localhost session with
		// production's marker.
		const { container } = render(ConnectDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });

		await fireEvent.click(screen.getByText('Quick Connect'));
		await fireEvent.submit(container.querySelector('#quick-form'));

		const [, payload] = mockDispatch.mock.calls.find(
			([name]) => name === 'connection/update'
		);
		expect(payload.color).toBe('');
	});

	it('dispatches connected with the cluster version and flavor on quick connect', async () => {
		api.testResult = { success: true, version: { number: '8.12.0', build_flavor: 'default' } };
		const { container } = render(ConnectDialog, {
			context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]),
		});
		await fireEvent.click(screen.getByText('Quick Connect'));
		await fireEvent.submit(container.querySelector('#quick-form'));
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(mockDispatch).toHaveBeenCalledWith('connected', { version: '8.12.0', flavor: 'default' });
	});

	it('does not dispatch connected when quick connect fails', async () => {
		const { container } = render(ConnectDialog, {
			context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]),
		});
		await fireEvent.click(screen.getByText('Quick Connect'));
		await fireEvent.submit(container.querySelector('#quick-form'));
		await new Promise(resolve => setTimeout(resolve, 0));

		const connectedCalls = mockDispatch.mock.calls.filter(([event]) => event === 'connected');
		expect(connectedCalls).toHaveLength(0);
	});

	it('shows a chip in the color of the selected connection', async () => {
		stores.connections.set({
			connection: [
				{ name: 'Server A', host: 'http://server-a', port: '9200', color: '' },
				{ name: 'Production', host: 'http://prod', port: '9200', color: '#db2828' }
			]
		});
		const { container, getByRole } = render(ConnectDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });

		await fireEvent.change(getByRole('combobox'), { target: { value: '1' } });

		const chip = container.querySelector('.connection-chip');
		expect(chip.textContent.trim()).toBe('Production');
		expect(chip.style.background).toBe('rgb(219, 40, 40)');
	});

	it('shows no chip for an uncolored connection', async () => {
		const { container, getByRole } = render(ConnectDialog, { context: new Map([['modal-window', { close: vi.fn(), open: vi.fn() }]]) });

		await fireEvent.change(getByRole('combobox'), { target: { value: '0' } });

		expect(container.querySelector('.connection-chip')).toBeNull();
	});
});
