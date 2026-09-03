// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ManageConnectionsDialog from './ManageConnectionsDialog.svelte';
import { setStorage } from '../../../utils/storage';

const mockDispatch = vi.fn();

const stores = vi.hoisted(() => ({ connections: null, connection: null }));

const savedConnection = () => ({
	name: 'Local Test',
	host: 'http://localhost',
	port: '9200',
	useAuth: false,
	user: '',
	password: '',
	addHeaders: false,
	headers: [],
	useSshTunnel: false,
	ssh: {
		host: '',
		port: '22',
		username: '',
		authMethod: 'password',
		password: '',
		privateKeyContent: '',
		privateKeyName: '',
		passphrase: '',
	},
	color: '',
});

vi.mock('../../../utils/storage', () => ({
	setStorage: vi.fn(),
	getStorage: vi.fn(),
}));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	stores.connections = writable({ connection: [] });
	stores.connection = writable({});
	return {
		useStoreon: () => ({
			app: writable({ theme: 'light' }),
			connections: stores.connections,
			connection: stores.connection,
			dispatch: mockDispatch,
		}),
	};
});

const renderDialog = () =>
	render(ManageConnectionsDialog, {
		context: new Map([
			['modal-window', { close: vi.fn(), open: vi.fn() }],
		]),
	});

const dispatchedPayload = action => {
	const call = mockDispatch.mock.calls.find(([name]) => name === action);
	return call ? call[1] : undefined;
};

describe('ManageConnectionsDialog', () => {
	beforeEach(() => {
		mockDispatch.mockClear();
		setStorage.mockClear();
		stores.connections.set({ connection: [savedConnection()] });
		// The connection the app is currently talking to
		stores.connection.set({
			name: 'Local Test',
			host: 'http://localhost',
			port: '9200',
			useAuth: false,
			color: '',
			version: '8.12.0',
		});
	});

	it('renders sidebar with saved connections', () => {
		renderDialog();
		expect(screen.getByText('Manage Connections')).toBeTruthy();
		expect(screen.getByText('Local Test')).toBeTruthy();
		expect(screen.getByText('Add New')).toBeTruthy();
	});

	it('shows connection details in form', () => {
		renderDialog();

		// Form fields should be populated from the first selected connection "Local Test"
		const nameInput = screen.getByLabelText('Name');
		expect(nameInput.value).toBe('Local Test');

		const hostInput = screen.getByLabelText('Host');
		expect(hostInput.value).toBe('http://localhost');
	});

	it('switches to new connection form when Add New is clicked', async () => {
		renderDialog();

		const addNewBtn = screen.getByText('Add New');
		await fireEvent.click(addNewBtn);

		const nameInput = screen.getByLabelText('Name');
		expect(nameInput.value).toBe('New Connection');
	});

	it('shows a color dot in the sidebar for a colored connection', () => {
		stores.connections.set({
			connection: [{ ...savedConnection(), color: '#db2828' }],
		});
		const { container } = renderDialog();

		const dot = container.querySelector('.connection-dot');
		expect(dot.style.background).toBe('rgb(219, 40, 40)');
	});

	it('shows no dot for an uncolored connection', () => {
		const { container } = renderDialog();
		expect(container.querySelector('.connection-dot')).toBeNull();
	});

	describe('recoloring the active connection', () => {
		const recolorAndSave = async container => {
			await fireEvent.click(
				container.querySelector('[aria-label="#db2828"]')
			);
			await fireEvent.click(screen.getByText('Save'));
		};

		it('replaces the entry in place rather than reordering', async () => {
			const { container } = renderDialog();

			await recolorAndSave(container);

			expect(dispatchedPayload('connections/replace')).toMatchObject({
				index: 0,
			});
			expect(
				mockDispatch.mock.calls.some(
					([name]) => name === 'connections/delete'
				)
			).toBe(false);
		});

		it('pushes the new color to the live connection', async () => {
			const { container } = renderDialog();

			await recolorAndSave(container);

			expect(dispatchedPayload('connection/update')).toEqual({
				name: 'Local Test',
				color: '#db2828',
			});
		});

		it('pushes a rename alongside the color, so the pill cannot go stale', async () => {
			const { container } = renderDialog();

			await fireEvent.input(screen.getByLabelText('Name'), {
				target: { value: 'Production' },
			});
			await recolorAndSave(container);

			expect(dispatchedPayload('connection/update')).toEqual({
				name: 'Production',
				color: '#db2828',
			});
		});

		it('never pushes anything that addresses the cluster', async () => {
			const { container } = renderDialog();

			// Change the host too — it must not reach the live session, which is
			// still talking to the old one.
			await fireEvent.input(screen.getByLabelText('Host'), {
				target: { value: 'http://elsewhere' },
			});
			await recolorAndSave(container);

			expect(
				Object.keys(dispatchedPayload('connection/update')).sort()
			).toEqual(['color', 'name']);
		});

		it('stays quiet when neither name nor color changed', async () => {
			renderDialog();

			await fireEvent.input(screen.getByLabelText('Host'), {
				target: { value: 'http://elsewhere' },
			});
			await fireEvent.click(screen.getByText('Save'));

			expect(dispatchedPayload('connection/update')).toBeUndefined();
			expect(
				setStorage.mock.calls.some(([name]) => name === 'lastConnection')
			).toBe(false);
		});

		it('rewrites lastConnection so the label survives a restart', async () => {
			const { container } = renderDialog();

			await fireEvent.input(screen.getByLabelText('Name'), {
				target: { value: 'Production' },
			});
			await recolorAndSave(container);

			const [key, value] = setStorage.mock.calls.find(
				([name]) => name === 'lastConnection'
			);
			expect(key).toBe('lastConnection');
			expect(value.color).toBe('#db2828');
			expect(value.name).toBe('Production');
			// The rest of the live connection is carried across untouched
			expect(value.host).toBe('http://localhost');
			expect(value.version).toBe('8.12.0');
		});
	});

	describe('recoloring a connection that is not active', () => {
		it('leaves the live connection alone when it is a different cluster', async () => {
			stores.connection.set({
				name: 'Production',
				host: 'https://prod.example.com',
				port: '9200',
				color: '',
			});
			const { container } = renderDialog();

			await fireEvent.click(
				container.querySelector('[aria-label="#db2828"]')
			);
			await fireEvent.click(screen.getByText('Save'));

			expect(dispatchedPayload('connection/update')).toBeUndefined();
			expect(
				setStorage.mock.calls.some(([name]) => name === 'lastConnection')
			).toBe(false);
		});

		it('leaves the live connection alone when only the port differs', async () => {
			// Same name and host, different cluster
			stores.connection.set({
				name: 'Local Test',
				host: 'http://localhost',
				port: '9201',
				color: '',
			});
			const { container } = renderDialog();

			await fireEvent.click(
				container.querySelector('[aria-label="#db2828"]')
			);
			await fireEvent.click(screen.getByText('Save'));

			expect(dispatchedPayload('connection/update')).toBeUndefined();
			expect(
				setStorage.mock.calls.some(([name]) => name === 'lastConnection')
			).toBe(false);
		});
	});

	describe('deleting a connection', () => {
		let confirmSpy;

		beforeEach(() => {
			confirmSpy = vi.spyOn(window, 'confirm');
		});

		afterEach(() => {
			confirmSpy.mockRestore();
		});

		it('deletes the connection when the confirmation is accepted', async () => {
			confirmSpy.mockReturnValue(true);
			renderDialog();

			await fireEvent.click(screen.getByText('Delete'));

			expect(dispatchedPayload('connections/delete')).toEqual(
				savedConnection()
			);
		});

		it('does not delete the connection when the confirmation is cancelled', async () => {
			confirmSpy.mockReturnValue(false);
			renderDialog();

			await fireEvent.click(screen.getByText('Delete'));

			expect(
				mockDispatch.mock.calls.some(([name]) => name === 'connections/delete')
			).toBe(false);
			expect(screen.getByText('Local Test')).toBeTruthy();
		});

		it('names the connection in the confirmation prompt', async () => {
			confirmSpy.mockReturnValue(false);
			renderDialog();

			await fireEvent.click(screen.getByText('Delete'));

			expect(confirmSpy).toHaveBeenCalledWith(
				'Delete the connection "Local Test"?'
			);
		});

		it('falls back to host:port in the prompt for an unnamed connection', async () => {
			stores.connections.set({
				connection: [{ ...savedConnection(), name: '' }],
			});
			confirmSpy.mockReturnValue(false);
			renderDialog();

			await fireEvent.click(screen.getByText('Delete'));

			expect(confirmSpy).toHaveBeenCalledWith(
				'Delete the connection "http://localhost:9200"?'
			);
		});
	});
});
