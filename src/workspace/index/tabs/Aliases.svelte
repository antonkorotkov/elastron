<script>
  import JSONEditor from 'jsoneditor'
  import { onMount, onDestroy, afterUpdate, getContext } from 'svelte'
  import { useStoreon } from '@storeon/svelte'
  import get from 'lodash/get'

  import Table from '../../../components/tables/Table.svelte'
  import Cell from './AliasTableCell.svelte'

  let aliasesPreviewEditor, aEditor
  let isLoading = false,
    canUpdate = true

  const { dispatch, index, connection } = useStoreon('index', 'connection')

  const columns = [
    'Name',
    'Filter',
    'Is Write Index',
    'Index Routing',
    'Search Routing',
    'Actions',
  ]

  const aliases = get(
    $index.info,
    [$index.selected, $index.selected, 'aliases'],
    false
  )

  let rows = []
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
    rows.push(row)
  }
</script>

<Table
  {columns}
  {rows}
  {Cell}
  emptyMessage="No aliases found"
  selectable
  sortable />
