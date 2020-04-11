<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import Notification from './Notification.svelte'

  const { dispatch, notifications } = useStoreon('notifications')

  onMount(() => {
    setInterval(() => {
      dispatch('notification/shift')
    }, 3000)
  })
</script>

<style>
  .notifications {
    position: absolute;
    top: 4rem;
    right: 1rem;
    width: 30rem;
    z-index: 1001;
  }
</style>

{#if $notifications.length}
  <div class="notifications">
    {#each $notifications as notification}
      <Notification notification={notification} />
    {/each}
  </div>
{/if}