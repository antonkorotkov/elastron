<script>
  import PercentToHex from 'percent-to-hex'
  import isEmpty from 'lodash/isEmpty'

  // warning: circular dependency (this is for a reason)
  import Query from './Query.svelte'

  export let query, queries

  let active = false

  const getTimeColor = time => {
    let total = 0
    if (queries && queries.length) {
      total = queries.reduce((sum, item) => sum + item.time_in_nanos, 0)
    }
    return PercentToHex([time / total, 70, 60])
  }

  const getTimeMillis = time => time / 1000000
</script>

<div class="title" class:active on:click={() => (active = !active)}>
  <i class="dropdown icon" />
  {query.type}
  <small class="ui label">{query.description}</small>
  <small
    class="ui label"
    style="background-color:{getTimeColor(query.time_in_nanos)}">
    {getTimeMillis(query.time_in_nanos || 0)}ms
  </small>
</div>
<div class="content" class:active>
  {#if !isEmpty(query.breakdown)}
    <ul class="ui list">
      {#each Object.keys(query.breakdown) as i}
        <li>
          <strong>{i}</strong>
          :
          <span class="ui label">{query.breakdown[i]}</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if query.children && query.children.length}
    <div class="ui styled fluid accordion">
      {#each query.children as q, i}
        <Query query={q} queries={query.children} />
      {/each}
    </div>
  {/if}
</div>
