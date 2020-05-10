<script>
  import { useStoreon } from '@storeon/svelte'

  const { internet } = useStoreon('internet')
</script>

{#if $internet.online}
  <span class="ui green empty circular label tiny" title="Online" />
{:else}
  <span class="ui red empty circular label tiny" title="Offline" />
{/if}
