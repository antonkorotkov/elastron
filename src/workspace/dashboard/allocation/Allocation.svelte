<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'
  import orderBy from 'lodash/orderBy'
  import isEmpty from 'lodash/isEmpty'

  import Table from '../../../components/tables/Table.svelte'
  import {
    humanStoreSizeToPseudoBytes,
    classToggle,
    filterArrayBy,
    isThemeToggleChecked,
  } from '../../../utils/helpers.js'

  const { dispatch, allocation, app } = useStoreon('allocation', 'app')

  let search = $allocation.search

  const onTableSort = (column, index, direction) => {
    const sort = o => {
      switch (column) {
        case 'shards':
        case 'disk.percent':
          return Number(o[index])
        case 'disk.indices':
        case 'disk.used':
        case 'disk.avail':
        case 'disk.total':
          return humanStoreSizeToPseudoBytes(o[index])
        default:
          return o[index]
      }
    }

    const sorted = orderBy($allocation.data, [sort], [direction])
    dispatch('elasticsearch/allocation/update', { data: sorted })
  }

  $: filterRows = data => {
    if (isEmpty(search)) return data

    return filterArrayBy(data, search)
  }

  $: inverted = isThemeToggleChecked($app.theme)

  onMount(async () => {
    if (!$allocation.data.length) dispatch('elasticsearch/allocation/fetch')
  })
</script>

<div class="ui segments">
  <div class="ui segment" class:inverted>
    <div class="ui grid">
      <div class="eight wide column middle aligned">
        <h4>Allocation</h4>
      </div>
      <div class="eight wide column right aligned">
        <div class="ui mini form search">
          <div class="inline fields">
            <div class="field">
              <input
                bind:value={search}
                on:change={e =>
                  dispatch('elasticsearch/allocation/update', {
                    search,
                  })}
                type="text"
                placeholder="Search"
              />
            </div>
          </div>
        </div>

        <i
          class="sync alternate icon refresh"
          class:loading={$allocation.loading}
          on:mouseover={e => classToggle(e, 'green')}
          on:mouseout={e => classToggle(e, 'green')}
          on:click={e => dispatch('elasticsearch/allocation/fetch')}
        />
      </div>
    </div>
  </div>
  {#if $allocation.columns.length}
    <Table
      columns={$allocation.columns}
      rows={filterRows($allocation.data)}
      emptyMessage="No allocations found"
      sorter={onTableSort}
      selectable
      sortable
    />
  {:else}
    <div class="ui segment" class:inverted>
      <p>
        No
        <code>allocation</code>
        data yet
      </p>
    </div>
  {/if}
</div>

<style>
  .refresh {
    cursor: pointer;
  }

  .search {
    display: inline-block;
  }

  .search .fields {
    margin: 0;
  }
</style>
