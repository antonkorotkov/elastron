<script>
  export let aggregations

  import Query from './Query.svelte'
</script>

<div class="ui divider" />
<div class="profile-table__aggregations">
  {#if aggregations && aggregations.length}
    <h5 class="ui header">Aggregations</h5>
    <div class="ui styled fluid accordion">
      {#each aggregations as query, i}
        <Query {query} queries={aggregations} />
      {/each}
    </div>
  {/if}
</div>
