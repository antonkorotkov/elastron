<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'
  import orderBy from 'lodash/orderBy'

  import API from '../../../api/elasticsearch'
  import Table from '../../../components/tables/Table.svelte'
  import { humanStoreSizeToPseudoBytes } from '../../../utils/helpers.js'

  const { dispatch, allocation } = useStoreon('allocation')

  const onTableSort = (column, index, direction) => {
    const sort = o => {
      switch (column) {
        case 'shards':
        case 'disk.percent':
          return Number(o[index])
        case 'disk.indices':
        case 'disk.used':
        case 'disk.avail':
        case 'disk.total':
          return humanStoreSizeToPseudoBytes(o[index])
        default:
          return o[index]
      }
    }

    const sorted = orderBy($allocation.data, [sort], [direction])
    dispatch('elasticsearch/allocation/update', { data: sorted })
  }

  onMount(async () => {
    if (!$allocation.data.length) dispatch('elasticsearch/allocation/fetch')
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
        <h4>Allocation</h4>
      </div>
      <div class="eight wide column right aligned">
        <i
          class="sync alternate icon refresh"
          class:loading={$allocation.loading}
          on:click={e => dispatch('elasticsearch/allocation/fetch')} />
      </div>
    </div>
  </div>
  {#if $allocation.columns.length}
    <Table
      columns={$allocation.columns}
      rows={$allocation.data}
      emptyMessage="No allocations found"
      sorter={onTableSort}
      selectable
      sortable />
  {:else}
    <div class="ui segment">
      <p>
        No
        <code>allocation</code>
        data yet
      </p>
    </div>
  {/if}
</div>
