<script>
  import { beforeUpdate, afterUpdate } from 'svelte'
  import { useStoreon } from '@storeon/svelte'

  import { isThemeToggleChecked } from '../../../utils/helpers'

  let div
  let autoscroll

  beforeUpdate(() => {
    autoscroll = div && div.offsetHeight + div.scrollTop > div.scrollHeight - 20
  })

  afterUpdate(() => {
    if (autoscroll) div.scrollTo(0, div.scrollHeight)
  })

  const { app, importExport } = useStoreon('app', 'importExport')

  $: inverted = isThemeToggleChecked($app.theme)

  $: logs = $importExport.logs.filter(item =>
    $importExport.logFilter.includes(item.type)
  )
</script>

<div class="ui divided selection list" class:inverted bind:this={div}>
  {#if logs.length}
    {#each logs as log (log.id)}
      <a class="item" href>
        <div
          class="ui horizontal label"
          class:red={log.type === 'error'}
          class:blue={log.type === 'info'}
          class:yellow={log.type === 'verbose'}
        >
          {log.type}
        </div>
        {log.message}
      </a>
    {/each}
  {:else}
    Log is empty
  {/if}
</div>

<style>
  .ui.list {
    max-height: 80vh;
    overflow-y: auto;
  }
  .ui.list .label {
    min-width: 6em;
  }
  .ui.list .item {
    word-wrap: break-word;
  }
</style>
