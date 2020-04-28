<script>
  export let cell = ''
  export let i = 0
  export let columns
</script>

{#if columns[i] === 'health'}
  <div class="ui label {cell}">{cell}</div>
{:else}{cell}{/if}
