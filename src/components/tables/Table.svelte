<script>
  import Column from './Column.svelte'
  import RowCell from './RowCell.svelte'

  export let columns
  export let rows
  export let sortable = false
  export let selectable = false
  export let emptyMessage = 'No data'
  export let Cell = null

  let CellRenderer = Cell ? Cell : RowCell
</script>

<table class="ui attached table" class:selectable class:sortable>
  <thead>
    <tr>
      {#each columns as column}
        <th>
          <Column {column} />
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#if rows.length}
      {#each rows as row}
        <tr>
          {#each row as cell, i}
            <td>
              <CellRenderer {cell} {i} {columns} />
            </td>
          {/each}
        </tr>
      {/each}
    {:else}
      <tr>
        <td colspan={columns.length}>{emptyMessage}</td>
      </tr>
    {/if}
  </tbody>
</table>
