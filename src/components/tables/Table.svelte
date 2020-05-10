<script>
  import Column from './Column.svelte'
  import RowCell from './RowCell.svelte'

  export let columns
  export let rows
  export let sortable = false
  export let selectable = false
  export let emptyMessage = 'No data'
  export let Cell = null
  export let sorter = () => {}

  let sorted = {}

  let CellRenderer = Cell ? Cell : RowCell

  const onColumnClick = (column, index) => {
    if (!sortable) return

    sorted = sorted[index]
      ? { [index]: sorted[index] === 'asc' ? 'desc' : 'asc' }
      : { [index]: 'asc' }

    if (typeof sorter === 'function') {
      sorter(column, index, sorted[index])
    }
  }

  const getColspan = (row, i, total) => {
    if (total > row && i + 1 == row) {
      return total - row + 1
    }
    return 1
  }
</script>

<table class="ui attached table" class:selectable class:sortable>
  <thead>
    <tr>
      {#each columns as column, i}
        <th
          on:click={e => onColumnClick.call(e, column, i)}
          class:sorted={sorted[i]}
          class:ascending={sorted[i] === 'asc'}
          class:descending={sorted[i] === 'desc'}>
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
            <td colspan={getColspan(row.length, i, columns.length)}>
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
