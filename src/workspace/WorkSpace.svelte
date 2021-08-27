<script>
  import { useStoreon } from '@storeon/svelte'
  import { routerKey } from '@storeon/router'

  import Dashboard from './dashboard/Dashboard.svelte'
  import Search from './search/Search.svelte'
  import Index from './index/Index.svelte'
  import ImportExport from './import-export/Index.svelte'

  const { [routerKey]: route } = useStoreon(routerKey)
</script>

<div class="ui padded">
  {#if $route.match.page === 'dashboard'}
    <Dashboard />
  {:else if $route.match.page === 'index'}
    <Index />
  {:else if $route.match.page === 'search'}
    <Search />
  {:else if $route.match.page === 'import-export'}
    <ImportExport />
  {:else}
    <Dashboard />
  {/if}
</div>

<style>
  .padded {
    padding-left: 1rem;
    padding-right: 1rem;
    padding-bottom: 5rem;
  }
</style>
