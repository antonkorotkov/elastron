<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import API from '../../../api/elasticsearch'
  import Table from '../../../components/tables/Table.svelte'

  const { dispatch, shards } = useStoreon('shards')

  onMount(async () => {
    dispatch('elasticsearch/shards/fetch')
  })
</script>

<div class="ui segments">
  <div class="ui segment">
    <h4>Shards</h4>
  </div>
  {#if $shards.columns.length}
    <Table
      columns={$shards.columns}
      rows={$shards.data}
      emptyMessage="No shards found"
      selectable />
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
