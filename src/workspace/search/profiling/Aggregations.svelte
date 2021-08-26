<script>
  export let aggregations

  import { useStoreon } from '@storeon/svelte'
  import { isThemeToggleChecked } from '../../../utils/helpers'
  import Query from './Query.svelte'

  const { app } = useStoreon('app')

  $: inverted = isThemeToggleChecked($app.theme)
</script>

{#if aggregations && aggregations.length}
  <h5 class="ui header" class:inverted>Aggregations</h5>
  <div class="ui fluid accordion styled" class:inverted>
    {#each aggregations as query, i}
      <Query {query} queries={aggregations} />
    {/each}
  </div>
{/if}
