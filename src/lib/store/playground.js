import { setStorage } from '../utils/storage.js';

const initialRequest = {
	method: 'GET',
	path: '{{index}}/_search',
	body: {},
	headers: [],
	name: 'New Request'
};

export const builtinTemplates = [
	{
		id: 'built-in-1',
		name: 'Empty Search',
		method: 'GET',
		path: '{{index}}/_search',
		body: {},
		headers: [],
		type: 'built-in'
	},
	{
		id: 'built-in-2',
		name: 'Cluster Health',
		method: 'GET',
		path: '/_cluster/health',
		body: {},
		headers: [],
		type: 'built-in'
	},
	{
		id: 'built-in-3',
		name: 'Update Index Settings',
		method: 'PUT',
		path: '{{index}}/_settings',
		body: { 'index': { 'number_of_replicas': 1 } },
		headers: [],
		type: 'built-in'
	},
	{
		id: 'built-in-4',
		name: 'Create Index',
		method: 'PUT',
		path: '{{index}}',
		body: { 'settings': {}, 'mappings': {} },
		headers: [],
		type: 'built-in'
	},
	{
		id: 'built-in-5',
		name: 'Delete Index',
		method: 'DELETE',
		path: '{{index}}',
		body: {},
		headers: [],
		type: 'built-in'
	},
	{
		id: 'built-in-6',
		name: 'Update Mapping',
		method: 'PUT',
		path: '{{index}}/_mapping',
		body: { 'properties': {} },
		headers: [],
		type: 'built-in'
	},
	{
		id: 'built-in-7',
		name: 'Index Document',
		method: 'POST',
		path: '{{index}}/_doc',
		body: { 'field': 'value' },
		headers: [],
		type: 'built-in'
	},
	{
		id: 'built-in-8',
		name: 'Delete Document',
		method: 'DELETE',
		path: '{{index}}/_doc/1',
		body: {},
		headers: [],
		type: 'built-in'
	}
];

export function playground(store) {
	store.on('@init', () => ({
		playground: {
			currentRequest: { ...initialRequest },
			builtinTemplates,
			customTemplates: [],
			isDrawerOpen: false
		}
	}));

	store.on('playground/hydrate', (state, customTemplates) => {
		return {
			playground: {
				...state.playground,
				customTemplates: customTemplates || []
			}
		};
	});

	store.on('playground/toggleDrawer', (state) => {
		return {
			playground: {
				...state.playground,
				isDrawerOpen: !state.playground.isDrawerOpen
			}
		};
	});

	store.on('playground/loadTemplate', (state, template) => {
		return {
			playground: {
				...state.playground,
				currentRequest: { ...template }
			}
		};
	});

	store.on('playground/saveTemplate', (state, request) => {
		let customTemplates = [...state.playground.customTemplates];
		const existingIndex = customTemplates.findIndex(t => t.id === request.id);

		let newRequest = { ...request, type: 'custom' };

		if (existingIndex >= 0) {
			customTemplates[existingIndex] = newRequest;
		} else {
			newRequest.id = `custom_${Date.now()}`;
			customTemplates.push(newRequest);
		}

		setStorage('playground_templates', customTemplates);

		return {
			playground: {
				...state.playground,
				customTemplates,
				currentRequest: newRequest
			}
		};
	});

	store.on('playground/deleteTemplate', (state, id) => {
		const customTemplates = state.playground.customTemplates.filter(t => t.id !== id);

		setStorage('playground_templates', customTemplates);

		return {
			playground: {
				...state.playground,
				customTemplates
			}
		};
	});
}
