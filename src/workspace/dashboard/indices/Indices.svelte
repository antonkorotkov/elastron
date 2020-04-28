<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import API from '../../../api/elasticsearch'
  import Table from '../../../components/tables/Table.svelte'
  import Cell from './Cell.svelte'

  const { dispatch, indices } = useStoreon('indices')

  onMount(async () => {
    dispatch('elasticsearch/indices/fetch')
  })
</script>

<div class="ui segments">
  <div class="ui segment">
    <h4>Indices</h4>
  </div>
  {#if $indices.columns.length}
    <Table
      columns={$indices.columns}
      rows={$indices.data}
      {Cell}
      emptyMessage="No indices found"
      selectable
      sortable />
  {:else}
    <div class="ui segment">
      <p>
        No
        <code>indices</code>
        data yet
      </p>
    </div>
  {/if}
</div>
