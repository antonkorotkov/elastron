<script>
  export let shard

  let active = false

  import Search from './Search.svelte'
  import Aggregation from './Aggregation.svelte'
</script>

<div class="profile-table__shard">
  <div class="title" class:active on:click={() => (active = !active)}>
    <i class="dropdown icon" />
    {shard.id}
  </div>
  <div class="content" class:active>
    {#if shard.searches && shard.searches.length}
      {#each shard.searches as search, i}
        <Search {search} />
      {/each}
    {/if}
    {#if shard.aggregations && shard.aggregations.length}
      <Aggregation aggregations={shard.aggregations} />
    {/if}
  </div>
</div>
