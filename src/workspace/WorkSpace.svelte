<script>
  import { useStoreon } from '@storeon/svelte'
  import { routerKey } from '@storeon/router'

  import Dashboard from './dashboard/Dashboard.svelte'

  const { [routerKey]: route } = useStoreon(routerKey)
</script>

{#if $route.match.page === 'dashboard'}
  <Dashboard />
{:else if $route.match.page === 'health'}
  health
{:else}
  <Dashboard />
{/if}