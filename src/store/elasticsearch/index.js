import API from '../../api/elasticsearch'

export const index = store => {
	store.on('@init', () => ({
		index: {
			selected: '',
			loading: false,
			info: {},
		},
	}))

	store.on('connected', () => {
		store.dispatch('elasticsearch/index/select', '')
	})

	store.on('disconnected', () => {
		store.dispatch('elasticsearch/index/select', '')
	})

	store.on('elasticsearch/index/select', (state, selected) => ({
		index: {
			...state.index,
			selected,
		},
	}))

	store.on('elasticsearch/index/loading', (state, loading) => ({
		index: {
			...state.index,
			loading,
		},
	}))

	store.on('elasticsearch/index/info', (state, { index, info }) => {
		return {
			index: {
				...state.index,
				info: {
					...state.index.info,
					[index]: info,
				},
			},
		}
	})

	store.on('elasticsearch/index/fetch', async state => {
		if (state.index.loading) return
		try {
			store.dispatch('elasticsearch/index/loading', true)
			const api = new API(state.connection)
			const info = await api.getIndex(state.index.selected)
			if (info) {
				store.dispatch('elasticsearch/index/info', {
					index: state.index.selected,
					info,
				})
				store.dispatch('elasticsearch/index/loading', false)
			} else {
				store.dispatch('notification/add', {
					type: 'error',
					message: 'Could not get index info',
				})
				store.dispatch('elasticsearch/index/loading', false)
			}
		} catch (error) {
			store.dispatch('notification/add', {
				type: 'error',
				message: error.message,
			})
			store.dispatch('elasticsearch/index/loading', false)
		}
	})
}
