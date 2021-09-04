<script>
  import { useStoreon } from '@storeon/svelte'

  import AdvancedDropdown from '../../../components/inputs/AdvancedDropdown.svelte'
  import ConnectionSelector from '../../../components/inputs/ConnectionSelector.svelte'

  export let direction

  const { dispatch, importExport, history } = useStoreon(
    'importExport',
    'history'
  )

  const onConnectionSelect = e => {
    dispatch(`ie/${direction}/connection`, e.detail.value)
  }

  const onConnectionClear = () => {
    dispatch(`ie/${direction}/connection`, null)
  }

  let selectedConnection = null

  $: {
    if (
      $importExport[direction].connection !== null &&
      typeof $history.connection[$importExport[direction].connection] !==
        'undefined'
    ) {
      selectedConnection = {
        value: $importExport[direction].connection,
        label: $history.connection[$importExport[direction].connection].name,
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
        isDisabled={!selectedConnection}
        placeholder={selectedConnection
          ? 'Select Index...'
          : 'Select connection first...'}
      />
    </div>
  </div>
</div>

<style>
  .remote-index-selector .fields {
    margin-bottom: 0;
  }
</style>
