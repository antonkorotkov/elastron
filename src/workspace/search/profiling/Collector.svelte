<script>
  import { useStoreon } from '@storeon/svelte'

  const { server, app } = useStoreon('server', 'app')

  // warning: circular dependency (this is for a reason)
  import Collector from './Collector.svelte'
  import profiling, { getTimeMillis, getTimeColor } from './'
  import { isThemeToggleChecked } from '../../../utils/helpers'

  export let collector, collectors

  let active = false

  $: timeInNanos = profiling
    .collector(collector)
    .getNanos($server.version.number)

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="title" class:active on:click={() => (active = !active)}>
  <i class="dropdown icon" />
  {profiling.collector(collector).getName($server.version.number)}
  <small
    class="ui label"
    style="background-color:{getTimeColor(
      timeInNanos,
      collectors.map(c =>
        profiling.collector(c).getNanos($server.version.number)
      )
    )}"
  >
    {getTimeMillis(timeInNanos || 0)}ms
  </small>
</div>
<div class="content" class:active>
  <small class="ui label">
    {profiling.collector(collector).getReason($server.version.number)}
  </small>
  {#if collector.children && collector.children.length}
    <div class="ui fluid accordion" class:inverted class:styled={!inverted}>
      {#each collector.children as q, i}
        <Collector collector={q} collectors={collector.children} />
      {/each}
    </div>
  {/if}
</div>
