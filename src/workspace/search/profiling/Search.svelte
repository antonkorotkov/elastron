<script>
  export let search

  import Query from './Query.svelte'
  import Collector from './Collector.svelte'
</script>

<div class="profile-table__search">
  {#if search.query && search.query.length}
    <h5 class="ui header">Search Queries</h5>
    {#if search.rewrite_time}
      <small class="ui label">Rewrite Time: {search.rewrite_time}</small>
    {/if}
    <div class="ui styled fluid accordion">
      {#each search.query as query, i}
        <Query {query} queries={search.query} />
      {/each}
    </div>
  {/if}
  {#if search.collector && search.collector.length}
    <h5 class="ui header">Search Collectors</h5>
    <div class="ui styled fluid accordion">
      {#each search.collector as collector, i}
        <Collector {collector} collectors={search.collector} />
      {/each}
    </div>
  {/if}
</div>
