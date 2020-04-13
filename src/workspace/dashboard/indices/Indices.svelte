<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import API from '../../../api/elasticsearch'

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
    <table class="ui selectable attached table">
      <thead>
        <tr>
          {#each $indices.columns as column}
          <th>{column.toUpperCase()}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if $indices.data.length}
          {#each $indices.data as row}
            <tr>
              {#each row as entry, i}
                {#if $indices.columns[i] === 'health'}
                  <td>
                    <div class="ui label {entry}">{entry}</div>
                  </td>
                {:else}
                  <td>{entry}</td>
                {/if}
              {/each}
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan={$indices.columns.length}>No indices</td>
          </tr>
        {/if}
      </tbody>
    </table>
  {:else}
    <div class="ui segment">
      <p>No <code>indices</code> data yet</p>
    </div>
  {/if}
</div>