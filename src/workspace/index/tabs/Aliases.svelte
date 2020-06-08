<script>
  import JSONEditor from 'jsoneditor'
  import { useStoreon } from '@storeon/svelte'
  import { afterUpdate, onMount } from 'svelte'
  import get from 'lodash/get'

  import Table from '../../../components/tables/Table.svelte'
  import Cell from './AliasTableCell.svelte'

  const { index } = useStoreon('index')

  const columns = [
    'Name',
    'Filter',
    'Is Write Index',
    'Index Routing',
    'Search Routing',
    'Actions',
  ]

  $: rows = () => {
    const _rows = []
    const aliases = get(
      $index,
      ['info', $index.selected, $index.selected, 'aliases'],
      {}
    )
    for (let i in aliases) {
      let alias = aliases[i]
      let filter = get(alias, 'filter', false)
      let row = [
        i,
        filter ? JSON.stringify(filter, null, '  ') : '',
        get(alias, 'is_write_index', false),
        get(alias, 'index_routing', ''),
        get(alias, 'search_routing', ''),
        i,
      ]
      _rows.push(row)
    }

    return _rows
  }
</script>

<Table
  {columns}
  rows={rows()}
  {Cell}
  emptyMessage="No aliases found"
  selectable
  sortable />
