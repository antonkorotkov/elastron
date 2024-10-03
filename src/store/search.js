import API from '../api/elasticsearch'
import get from 'lodash/get'
import isEmpty from 'lodash/isEmpty'

export const search = store => {
	store.on('@init', () => ({
		search: {
			loading: false,
			profiling: false,
			explain: false,
			type: 'uri',
			index: '_all',
			useDocType: false,
			docType: '_doc',
			useSource: false,
			_source: '',
			requestBody: {
				query: {
					bool: {
						must: {
							match_all: {},
						},
					},
				},
				size: 10,
				from: 0,
				_source: true,
			},
			uriQuery: '*',
			sort: '',
			size: 10,
			from: 0,
			response: {},
			aggs: {},
			results: [],
			profile: {},
			stats: {
				total_results: 0,
				time: 0,
				total_shards: 0,
				successful_shards: 0,
				skipped_shards: 0,
				failed_shards: 0,
			},
			view: 'hits',
			editDoc: null,
		},
	}))

	store.on('connected', () => {
		store.dispatch('elasticsearch/indices/fetch')
		store.dispatch('search/update', { index: '_all', results: [] })
	})

	store.on('search/documents/reindex', async (state, data) => {
		try {
			store.dispatch('search/loading', true)

			const { _index, _type, _id } = state.search.editDoc

			const response = await new API(state.connection).indexDocument(
				_index,
				_type,
				_id,
				data
			)

			if (
				get(response, 'result') === 'updated' ||
				get(response, '_id', false)
			) {
				store.dispatch('notification/add', {
					type: 'success',
					message: `Document with id '${_id}' in index '${_index}' was successfully reindexed`,
				})

				const results = state.search.results.map((doc, index) => {
					if (doc._id === _id && doc._index === _index) {
						return {
							...doc,
							_source: data,
						}
					}

					return doc
				})
				store.dispatch('search/update', {
					results,
					view: 'hits',
				})
			}

			store.dispatch('search/loading', false)
		} catch (error) {
			store.dispatch('search/loading', false)
			store.dispatch('notification/add', {
				type: 'error',
				message: get(
					error,
					'response.data.error.root_cause[0].reason',
					get(error, 'response.data.error.reason', error.message)
				),
			})
		}
	})

	store.on('search/documents/update', async (state, data) => {
		try {
			store.dispatch('search/loading', true)

			const { _index, _type, _id } = state.search.editDoc

			const response = await new API(state.connection).updateDocument(
				_index,
				_type,
				_id,
				data
			)

			if (
				get(response, 'result') === 'updated' ||
				get(response, '_id', false)
			) {
				store.dispatch('notification/add', {
					type: 'success',
					message: `Document with id '${_id}' in index '${_index}' was successfully updated`,
				})

				const results = state.search.results.map((doc, index) => {
					if (doc._id === _id && doc._index === _index) {
						return {
							...doc,
							_source: data,
						}
					}

					return doc
				})
				store.dispatch('search/update', {
					results,
					view: 'hits',
				})
			}

			store.dispatch('search/loading', false)
		} catch (error) {
			store.dispatch('search/loading', false)
			store.dispatch('notification/add', {
				type: 'error',
				message: get(
					error,
					'response.data.error.root_cause[0].reason',
					get(error, 'response.data.error.reason', error.message)
				),
			})
		}
	})

	store.on('search/documents/delete', async (state, index) => {
		try {
			store.dispatch('search/loading', true)

			const document = get(state.search.results, index, false)

			if (document) {
				const { _index, _type, _id } = document
				const response = await new API(state.connection).deleteDocument(
					_index,
					_type,
					_id
				)
				if (get(response, 'result') === 'deleted') {
					store.dispatch('notification/add', {
						type: 'success',
						message: `Document with id '${_id}' was successfully deleted from index '${_index}'`,
					})

					const filteredResults = state.search.results.filter(
						(_v, i) => i !== index
					)
					store.dispatch('search/update', {
						results: filteredResults,
						stats: {
							...state.search.stats,
							total_results: filteredResults.length,
						},
					})
				}
			}

			store.dispatch('search/loading', false)
		} catch (error) {
			store.dispatch('search/loading', false)
			store.dispatch('notification/add', {
				type: 'error',
				message: get(
					error,
					'response.data.error.root_cause[0].reason',
					get(error, 'response.data.error.reason', error.message)
				),
			})
		}
	})

	store.on('search/update', (state, data) => {
		return {
			search: {
				...state.search,
				...data,
			},
		}
	})

	store.on('search/loading', (state, loading) => ({
		search: {
			...state.search,
			loading: !!loading,
		},
	}))

	store.on('search/run', async state => {
		try {
			store.dispatch('search/loading', true)

			const buildSearchParams = () => ({
				index: state.search.index,
				type: state.search.useDocType ? state.search.docType : false,
				query:
					state.search.type === 'uri'
						? state.search.uriQuery
						: state.search.requestBody,
				size: state.search.size,
				from: state.search.from,
				sort: state.search.sort,
				_source: state.search.useSource ? state.search._source : true,
				explain: state.search.explain,
			})

			const api = new API(state.connection)
			let results

			switch (state.search.type) {
				case 'uri':
					results = await api.uriSearch(buildSearchParams())
					break
				case 'body':
					results = await api.bodySearch(buildSearchParams())
					break
			}

			let profile = get(results, 'profile', {})
			store.dispatch('search/update', {
				response: results,
				aggs: get(results, 'aggregations', {}),
				results: get(results, 'hits.hits', []),
				profile,
			})

			const stats = {
				total_results: get(
					results,
					'hits.total.value',
					get(results, 'hits.total', 0)
				),
				time: get(results, 'took', 0),
				total_shards: get(results, '_shards.total', 0),
				successful_shards: get(results, '_shards.successful', 0),
				skipped_shards: get(results, '_shards.skipped', 0),
				failed_shards: get(results, '_shards.failed', 0),
			}
			store.dispatch('search/update', { stats })

			if (state.search.view === 'profile' && isEmpty(profile)) {
				store.dispatch('search/update', { view: 'hits' })
			}

			store.dispatch('search/loading', false)
		} catch (error) {
			store.dispatch('search/loading', false)
			store.dispatch('notification/add', {
				type: 'error',
				message: get(
					error,
					'response.data.error.root_cause[0].reason',
					get(error, 'response.data.error.reason', error.message)
				),
			})
		}
	})
}
