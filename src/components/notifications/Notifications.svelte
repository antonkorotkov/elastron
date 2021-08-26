<script>
  import { useStoreon } from '@storeon/svelte'

  import Notification from './Notification.svelte'

  const { notifications } = useStoreon('notifications')
</script>

{#if $notifications.length}
  <div class="notifications">
    {#each $notifications as notification}
      <Notification {notification} />
    {/each}
  </div>
{/if}

<style>
  .notifications {
    position: fixed;
    top: 4rem;
    right: 1rem;
    width: 30rem;
    z-index: 1001;
  }
</style>
