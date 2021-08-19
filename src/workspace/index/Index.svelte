<script>
  import { useStoreon } from '@storeon/svelte'
  import { routerKey } from '@storeon/router'
  import { onMount } from 'svelte'

  import Index from './tabs/Index.svelte'
  import Mapping from './tabs/Mapping.svelte'
  import Aliases from './tabs/Aliases.svelte'
  import Settings from './tabs/Settings.svelte'
  import Templates from './tabs/Templates.svelte'
  import Monitoring from './tabs/Monitoring.svelte'
  import Status from './tabs/Status.svelte'
  import { isThemeToggleChecked } from '../../utils/helpers'

  const {
    dispatch,
    [routerKey]: route,
    indices,
    index,
    app,
  } = useStoreon(routerKey, 'indices', 'index', 'app')

  let activeTab

  const tabs = [
    { slug: 'index', name: 'Index', Component: Index },
    { slug: 'mapping', name: 'Mapping', Component: Mapping },
    { slug: 'settings', name: 'Settings', Component: Settings },
    { slug: 'aliases', name: 'Aliases', Component: Aliases },
    // { slug: 'templates', name: 'Templates', Component: Templates },
    // { slug: 'monitoring', name: 'Monitoring', Component: Monitoring },
    // { slug: 'status', name: 'Status', Component: Status },
  ]

  $: _indices = $indices.data.map(
    item =>
      item[
        $indices.columns.reduce(
          (i, item, index) => (item === 'index' ? index : i),
          0
        )
      ]
  )

  $: inverted = isThemeToggleChecked($app.theme)

  onMount(() => {
    dispatch('elasticsearch/index/select', $route.match.index || '')
    activeTab = 'index'
  })
</script>

<div class="ui segments">
  <div class="ui segment" class:inverted>
    <select
      id="index"
      class="ui dropdown"
      value={$index.selected}
      on:change={e => {
        dispatch('elasticsearch/index/select', e.target.value)
        activeTab = 'index'
      }}
      disabled={$index.loading}
    >
      <option value="">Select Index</option>
      {#if _indices.length}
        {#each _indices as index}
          <option value={index}>{index}</option>
        {/each}
      {/if}
    </select>
    <i
      class="sync alternate icon refresh"
      class:loading={$index.loading}
      on:click={e => dispatch('elasticsearch/index/fetch')}
    />
  </div>
</div>

{#if $index.selected && _indices.length}
  <div class="ui grid">
    <div class="two wide column">
      <div class="ui vertical fluid pointing menu" class:inverted>
        {#each tabs as tab}
          <a
            class="item"
            class:active={activeTab === tab.slug}
            href="javascript:;"
            on:click={e => (activeTab = tab.slug)}
          >
            {tab.name}
          </a>
        {/each}
      </div>
    </div>
    <div class="fourteen wide stretched column">
      <div class="ui segment" class:inverted>
        {#each tabs as tab}
          {#if activeTab === tab.slug}
            <svelte:component this={tab.Component} />
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .sync {
    margin-left: 1rem;
    cursor: pointer;
  }
</style>
