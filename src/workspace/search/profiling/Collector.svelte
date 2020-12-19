<script>
  import PercentToHex from 'percent-to-hex'
  import isEmpty from 'lodash/isEmpty'

  // warning: circular dependency (this is for a reason)
  import Collector from './Collector.svelte'

  export let collector, collectors

  let active = false

  const getTimeColor = time => {
    let total = 0
    if (collectors && collectors.length) {
      total = collectors.reduce((sum, item) => sum + item.time_in_nanos, 0)
    }
    return PercentToHex([time / total, 70, 60])
  }

  const getTimeMillis = time => time / 1000000
</script>

<div class="title" class:active on:click={() => (active = !active)}>
  <i class="dropdown icon" />
  {collector.name}
  <small
    class="ui label"
    style="background-color:{getTimeColor(collector.time_in_nanos)}">
    {getTimeMillis(collector.time_in_nanos || 0)}ms
  </small>
</div>
<div class="content" class:active>
  <small class="ui label">{collector.reason}</small>
  {#if collector.children && collector.children.length}
    <div class="ui styled fluid accordion">
      {#each collector.children as q, i}
        <Collector collector={q} collectors={collector.children} />
      {/each}
    </div>
  {/if}
</div>
