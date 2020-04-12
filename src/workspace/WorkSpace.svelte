<script>
  import { useStoreon } from '@storeon/svelte'
  import { routerKey } from '@storeon/router'

  import Dashboard from './dashboard/Dashboard.svelte'

  const { [routerKey]: route } = useStoreon(routerKey)
</script>

{#if $route.match.page === 'dashboard'}
  <Dashboard />
{:else if $route.match.page === 'mapping'}
  <div class="ui segment">Mapping comming soon</div>
{:else if $route.match.page === 'search'}
  <div class="ui segment">Search comming soon</div>
{:else}
  <Dashboard />
{/if}