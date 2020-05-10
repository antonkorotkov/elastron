<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'
  import orderBy from 'lodash/orderBy'

  import API from '../../../api/elasticsearch'
  import Table from '../../../components/tables/Table.svelte'
  import { humanStoreSizeToPseudoBytes } from '../../../utils/helpers.js'

  const { dispatch, shards } = useStoreon('shards')

  const onTableSort = (column, index, direction) => {
    const sort = o => {
      switch (column) {
        case 'shard':
        case 'docs':
          return Number(o[index])
        case 'store':
          return humanStoreSizeToPseudoBytes(o[index])
        default:
          return o[index]
      }
    }

    const sorted = orderBy($shards.data, [sort], [direction])
    dispatch('elasticsearch/shards/update', { data: sorted })
  }

  onMount(async () => {
    if (!$shards.data.length) dispatch('elasticsearch/shards/fetch')
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
        <h4>Shards</h4>
      </div>
      <div class="eight wide column right aligned">
        <i
          class="sync alternate icon refresh"
          class:loading={$shards.loading}
          on:click={e => dispatch('elasticsearch/shards/fetch')} />
      </div>
    </div>
  </div>
  {#if $shards.columns.length}
    <Table
      columns={$shards.columns}
      rows={$shards.data}
      emptyMessage="No shards found"
      sorter={onTableSort}
      selectable
      sortable />
  {:else}
    <div class="ui segment">
      <p>
        No
        <code>shards</code>
        data yet
      </p>
    </div>
  {/if}
</div>
