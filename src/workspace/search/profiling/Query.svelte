<script>
  import isEmpty from 'lodash/isEmpty'
  import { useStoreon } from '@storeon/svelte'

  const { server } = useStoreon('server')

  // warning: circular dependency (this is for a reason)
  import Query from './Query.svelte'
  import profiling, { getTimeMillis, getTimeColor } from './'

  export let query, queries

  let active = false

  $: timeInNanos = profiling.query(query).getNanos($server.version.number)
</script>

<div class="title" class:active on:click={() => (active = !active)}>
  <i class="dropdown icon" />
  {profiling.query(query).getType($server.version.number)}
  <small class="ui label">
    {profiling.query(query).getDescription($server.version.number)}
  </small>
  <small
    class="ui label"
    style="background-color:{getTimeColor(timeInNanos, queries.map(q =>
        profiling.query(q).getNanos($server.version.number)
      ))}">
    {getTimeMillis(timeInNanos || 0)}ms
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
