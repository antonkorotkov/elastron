import debounce from 'lodash/debounce';
import { setStorage } from '../utils/storage.js';

const initialRequest = {
	name: 'New Request',
	method: 'GET',
	path: '{{index}}/_search',
	bodyText: '{}',
	headers: [],
	activeTab: 'body'
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

// Persisting the draft is debounced (not the dispatch, which always writes the
// store synchronously) so navigating away mid-keystroke never loses text; only
// an abrupt exit within the window can, which `flushPlaygroundDraft` covers.
const persistDraft = debounce(draft => setStorage('playground_draft', draft), 300);

export const flushPlaygroundDraft = () => {
	persistDraft.flush();
};

const isBodyTextOnlyPatch = patch => {
	const keys = Object.keys(patch);
	return keys.length > 0 && keys.every(key => key === 'bodyText');
};

const writeThroughDraft = draft => {
	persistDraft(draft);
	persistDraft.flush();
};

export const playground = store => {
	store.on('@init', () => ({
		playground: {
			draft: { ...initialRequest },
			selectedIndex: null,
			responseBody: {},
			isRequestLoading: false,
			builtinTemplates,
			customTemplates: [],
			isDrawerOpen: false
		}
	}));

	store.on('connected', state => ({
		playground: {
			...state.playground,
			selectedIndex: null,
			responseBody: {},
			isRequestLoading: false
		}
	}));

	store.on('playground/hydrate', (state, { templates, draft } = {}) => {
		return {
			playground: {
				...state.playground,
				customTemplates: templates || [],
				draft: { ...state.playground.draft, ...(draft || {}) }
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

	store.on('playground/update', (state, patch) => {
		const memoryKeys = ['selectedIndex', 'responseBody', 'isRequestLoading'];
		const draftPatch = {};
		const memoryPatch = {};

		for (const key of Object.keys(patch)) {
			if (memoryKeys.includes(key)) memoryPatch[key] = patch[key];
			else draftPatch[key] = patch[key];
		}

		const draft = { ...state.playground.draft, ...draftPatch };

		if (Object.keys(draftPatch).length > 0) {
			if (isBodyTextOnlyPatch(draftPatch)) {
				persistDraft(draft);
			} else {
				writeThroughDraft(draft);
			}
		}

		return {
			playground: {
				...state.playground,
				...memoryPatch,
				draft
			}
		};
	});

	store.on('playground/loadTemplate', (state, template) => {
		const draft = {
			...state.playground.draft,
			name: template.name,
			method: template.method,
			path: template.path,
			bodyText: JSON.stringify(template.body || {}, null, 2),
			headers: template.headers ? [...template.headers] : []
		};

		writeThroughDraft(draft);

		return {
			playground: {
				...state.playground,
				draft
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

		const draft = { ...state.playground.draft, name: newRequest.name };
		writeThroughDraft(draft);

		return {
			playground: {
				...state.playground,
				customTemplates,
				draft
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
};
