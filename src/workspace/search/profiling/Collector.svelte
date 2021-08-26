<script>
  import { useStoreon } from '@storeon/svelte'
  import profiling, { getTimeMillis, getTimeColor } from './'
  import { isThemeToggleChecked } from '../../../utils/helpers'

  const { server, app } = useStoreon('server', 'app')

  export let collector, collectors

  let active = false

  $: timeInNanos = profiling
    .collector(collector)
    .getNanos($server.version.number)

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div
  class="title"
  class:inverted
  class:active
  on:click={() => (active = !active)}
>
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
    <div class="ui fluid accordion styled" class:inverted>
      {#each collector.children as q, i}
        <svelte:self collector={q} collectors={collector.children} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .title.inverted,
  .title.inverted:hover {
    color: white !important;
  }

  .ui.accordion.styled.inverted {
    background-color: #333;
  }
</style>
