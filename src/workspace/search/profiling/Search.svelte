<script>
  export let search

  import Query from './Query.svelte'
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
</div>
