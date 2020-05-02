<script>
  import { useStoreon } from '@storeon/svelte'
  import { routerKey } from '@storeon/router'

  import Dashboard from './dashboard/Dashboard.svelte'
  import Search from './search/Search.svelte'
  import Mapping from './mapping/Mapping.svelte'

  const { [routerKey]: route } = useStoreon(routerKey)
</script>

<style>
  .padded {
    padding: 0 1rem;
    margin-bottom: 5rem;
  }
</style>

<div class="ui padded">
  {#if $route.match.page === 'dashboard'}
    <Dashboard />
  {:else if $route.match.page === 'mapping'}
    <Mapping />
  {:else if $route.match.page === 'search'}
    <Search />
  {:else}
    <Dashboard />
  {/if}
</div>
