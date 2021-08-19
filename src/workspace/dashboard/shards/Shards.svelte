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

  const { dispatch, shards, app } = useStoreon('shards', 'app')

  let search = $shards.search

  const onTableSort = (column, index, direction) => {
    const sort = o => {
      switch (column) {
        case 'shard':
        case 'docs':
          return Number(o[index])
        case 'store':
          return humanStoreSizeToPseudoBytes(o[index])
        default:
          return o[index]
      }
    }

    const sorted = orderBy($shards.data, [sort], [direction])
    dispatch('elasticsearch/shards/update', { data: sorted })
  }

  onMount(async () => {
    if (!$shards.data.length) dispatch('elasticsearch/shards/fetch')
  })

  $: filterRows = data => {
    if (isEmpty(search)) return data

    return filterArrayBy(data, search)
  }

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui segments">
  <div class="ui segment" class:inverted>
    <div class="ui grid">
      <div class="eight wide column middle aligned">
        <h4>Shards</h4>
      </div>
      <div class="eight wide column right aligned">
        <div class="ui mini form search">
          <div class="inline fields">
            <div class="field">
              <input
                bind:value={search}
                on:change={e =>
                  dispatch('elasticsearch/shards/update', {
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
          class:loading={$shards.loading}
          on:mouseover={e => classToggle(e, 'green')}
          on:mouseout={e => classToggle(e, 'green')}
          on:click={e => dispatch('elasticsearch/shards/fetch')}
        />
      </div>
    </div>
  </div>
  {#if $shards.columns.length}
    <Table
      columns={$shards.columns}
      rows={filterRows($shards.data)}
      emptyMessage="No shards found"
      sorter={onTableSort}
      selectable
      sortable
    />
  {:else}
    <div class="ui segment" class:inverted>
      <p>
        No
        <code>shards</code>
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
