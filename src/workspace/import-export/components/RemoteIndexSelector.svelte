<script>
  import { useStoreon } from '@storeon/svelte'
  import API from '../../../api/elasticsearch'

  import AdvancedDropdown from '../../../components/inputs/AdvancedDropdown.svelte'
  import ConnectionSelector from '../../../components/inputs/ConnectionSelector.svelte'
  import { getIndexListFromIndexData } from '../../../utils/helpers'

  export let direction

  let selectedConnection = null
  let indicesLoading = false

  const { dispatch, importExport, history } = useStoreon(
    'importExport',
    'history'
  )

  const getConnectionByArrayIndex = index => {
    if (typeof $history.connection[index] !== 'undefined')
      return $history.connection[index]
    return null
  }

  const loadIndicesFromConnection = async connection => {
    try {
      indicesLoading = true

      const elastic = new API(connection)
      const data = await elastic.getIndices()
      indicesLoading = false

      return getIndexListFromIndexData(data)
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error',
        message: error.message,
      })
      indicesLoading = false
    }
  }

  const onConnectionSelect = async e => {
    const connection = getConnectionByArrayIndex(e.detail.value)
    if (connection !== null) {
      dispatch(`ie/${direction}/connection`, e.detail.value)
      const indices = await loadIndicesFromConnection(connection)
      dispatch(`ie/${direction}/remoteIndices`, indices)
    }
  }

  const onIndexSelect = e => dispatch(`ie/${direction}/index`, e.detail.value)

  const onConnectionClear = () => dispatch(`ie/${direction}/connection`, null)

  const onIndexClear = () => dispatch(`ie/${direction}/index`, null)

  $: getIndexSelectorPlaceholder = () => {
    if (!selectedConnection) return 'Select connection first...'
    if (indicesLoading) return 'Loading...'
    return 'Select Index...'
  }

  $: isIndexSelectorDisabled = () => {
    return !selectedConnection || indicesLoading
  }

  $: {
    if (
      $importExport[direction].connection !== null &&
      getConnectionByArrayIndex($importExport[direction].connection) !== null
    ) {
      selectedConnection = {
        value: $importExport[direction].connection,
        label: getConnectionByArrayIndex($importExport[direction].connection)
          .name,
      }
    } else selectedConnection = null
  }
</script>

<div class="remote-index-selector">
  <div class="fields">
    <div class="six wide field">
      <ConnectionSelector
        currentlySelected={selectedConnection}
        onSelect={onConnectionSelect}
        onClear={onConnectionClear}
      />
    </div>
    <div class="ten wide field">
      <AdvancedDropdown
        isDisabled={isIndexSelectorDisabled()}
        placeholder={getIndexSelectorPlaceholder()}
        items={$importExport[direction].remoteIndices}
        selectedValue={$importExport[direction].index}
        onSelect={onIndexSelect}
        onClear={onIndexClear}
      />
    </div>
  </div>
</div>

<style>
  .remote-index-selector .fields {
    margin-bottom: 0;
  }
</style>
