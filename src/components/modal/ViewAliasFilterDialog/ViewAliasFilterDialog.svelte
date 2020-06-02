<script>
  export let filter = ''
  export let onCancel = () => {}

  import { getContext } from 'svelte'

  const { close } = getContext('modal-window')

  const _onCancel = () => {
    onCancel()
    close()
  }
</script>

<div class="header">Alias Filter</div>

<div class="content">
  <pre>{filter}</pre>
</div>

<div class="actions">
  <div class="ui black deny button right" on:click={_onCancel}>Close</div>
</div>
