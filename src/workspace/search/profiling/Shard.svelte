<script>
  export let shard

  let active = false
</script>

<div class="title" class:active on:click={() => (active = !active)}>
  <i class="dropdown icon" />
  {shard.id}
</div>
<div class="content" class:active>test</div>
