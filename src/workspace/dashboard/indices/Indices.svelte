<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'
  import orderBy from 'lodash/orderBy'

  import API from '../../../api/elasticsearch'
  import Table from '../../../components/tables/Table.svelte'
  import Cell from './Cell.svelte'
  import { humanStoreSizeToPseudoBytes } from '../../../utils/helpers.js'

  const { dispatch, indices } = useStoreon('indices')

  const onTableSort = (column, index, direction) => {
    const sort = o => {
      switch (column) {
        case 'docs.count':
        case 'docs.deleted':
        case 'pri':
        case 'rep':
          return Number(o[index])
        case 'pri.store.size':
        case 'store.size':
          return humanStoreSizeToPseudoBytes(o[index])
        default:
          return o[index]
      }
    }

    const sorted = orderBy($indices.data, [sort], [direction])
    dispatch('elasticsearch/indices/update', { data: sorted })
  }

  onMount(async () => {
    if (!$indices.data.length) dispatch('elasticsearch/indices/fetch')
  })
</script>

<style>
  .refresh {
    cursor: pointer;
  }
</style>

<div class="ui segments">
  <div class="ui segment">
    <div class="ui grid">
      <div class="eight wide column">
        <h4>Indices</h4>
      </div>
      <div class="eight wide column right aligned">
        <i
          class="sync alternate icon refresh"
          class:loading={$indices.loading}
          on:click={e => dispatch('elasticsearch/indices/fetch')} />
      </div>
    </div>
  </div>
  {#if $indices.columns.length}
    <Table
      columns={$indices.columns}
      rows={$indices.data}
      sorter={onTableSort}
      emptyMessage="No indices found"
      selectable
      sortable
      {Cell} />
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
