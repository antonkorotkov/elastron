<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import API from '../../../api/elasticsearch'

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
    <table class="ui selectable attached table">
      <thead>
        <tr>
          {#each $shards.columns as column}
          <th>{column.toUpperCase()}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if $shards.data.length}
          {#each $shards.data as row}
            <tr>
              {#each row as entry}
                <td>{entry}</td>
              {/each}
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan={$shards.columns.length}>No shards</td>
          </tr>
        {/if}
      </tbody>
    </table>
  {:else}
    <div class="ui segment">
      <p>No <code>shards</code> data yet</p>
    </div>
  {/if}
</div>