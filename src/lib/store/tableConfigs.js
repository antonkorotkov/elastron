import { setStorage } from '../utils/storage'
import {
	pruneTableConfigs,
	sanitizeColumns,
	sanitizeTableConfigs,
} from '../utils/tableHelpers'

/**
 * Saved column layouts for the search results table, keyed by index name.
 *
 * Layouts belong to an index, not to a query: every search tab that looks at
 * the same index shares the same layout, which is why they live outside the
 * per-tab search state.
 */
export const tableConfigs = store => {
	store.on('@init', () => ({
		tableConfigs: {},
	}))

	store.on('tableConfigs/hydrate', (_state, configs) => ({
		tableConfigs: sanitizeTableConfigs(configs),
	}))

	/**
	 * Saves the table layout for an index. An empty column list deletes the
	 * entry rather than storing one, so "no saved layout" stays distinguishable
	 * from "a layout that happens to match the defaults".
	 */
	store.on('tableConfigs/update', (state, { index, config }) => {
		const key = String(index ?? '').trim() || '_all'
		const columns = sanitizeColumns(config?.columns)

		const next = { ...state.tableConfigs }
		if (columns.length) next[key] = { columns }
		else delete next[key]

		const configs = pruneTableConfigs(next, key)
		setStorage('tableConfigs', configs)

		return { tableConfigs: configs }
	})
}
