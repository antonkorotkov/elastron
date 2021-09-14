<script>
  import { useStoreon } from '@storeon/svelte'
  import { isThemeToggleChecked } from '../../../utils/helpers'

  const { app, importExport } = useStoreon('app', 'importExport')

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui divided selection list" class:inverted>
  {#if $importExport.logs.length}
    {#each $importExport.logs as log (log.id)}
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
    max-height: 85vh;
    overflow-y: auto;
  }
  .ui.list .label {
    min-width: 6em;
  }
  .ui.list .item {
    word-wrap: break-word;
  }
</style>
