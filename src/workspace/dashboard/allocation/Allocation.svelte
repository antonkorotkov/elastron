<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import API from '../../../api/elasticsearch'

  const { dispatch, allocation, connection } = useStoreon('allocation', 'connection')

  onMount(async () => {
		try {
      const { host, port} = $connection
      const api = new API(`${host}:${port}`)
      const { columns, data } = await api.getAllocation()
      if (data !== false) {
        dispatch('elasticsearch/allocation/update', {
          columns, data
        })
      }
    } catch (error) {
      dispatch('notification/add', {
        type: 'error', message: error.message
      })
    }
	})
</script>

<div class="ui segments">
  <div class="ui segment">
    <h4>Allocation</h4>
  </div>
  {#if $allocation.columns.length}
    <table class="ui selectable attached table">
      <thead>
        <tr>
          {#each $allocation.columns as column}
          <th>{column.toUpperCase()}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if $allocation.data.length}
          {#each $allocation.data as row}
            <tr>
              {#each row as entry}
                <td>{entry}</td>
              {/each}
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan={$allocation.columns.length}>No data</td>
          </tr>
        {/if}
      </tbody>
    </table>
  {:else}
    <div class="ui segment">
      <p>No <code>allocation</code> data</p>
    </div>
  {/if}
</div>