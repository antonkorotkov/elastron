<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import API from '../../../api/elasticsearch'
  import Table from '../../../components/tables/Table.svelte'

  const { dispatch, allocation } = useStoreon('allocation')

  onMount(async () => {
    dispatch('elasticsearch/allocation/fetch')
  })
</script>

<div class="ui segments">
  <div class="ui segment">
    <h4>Allocation</h4>
  </div>
  {#if $allocation.columns.length}
    <Table
      columns={$allocation.columns}
      rows={$allocation.data}
      emptyMessage="No allocations found"
      selectable />
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
