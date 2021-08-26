<script>
  import { fly } from 'svelte/transition'
  import { useStoreon } from '@storeon/svelte'
  import { onMount } from 'svelte'

  import Error from './Error.svelte'
  import Success from './Success.svelte'

  const { dispatch } = useStoreon()

  export let notification
  let timeout

  const scheduleHide = () => {
    timeout = setTimeout(() => {
      dispatch('notification/delete', notification.id)
    }, 5000)
  }

  const onNotificationMouseEnter = () => {
    clearTimeout(timeout)
  }

  onMount(scheduleHide)
</script>

<div
  on:click={() => dispatch('notification/delete', notification.id)}
  on:mouseenter={onNotificationMouseEnter}
  on:mouseleave={scheduleHide}
  class="ui message"
  class:negative={notification.type === 'error'}
  class:positive={notification.type === 'success'}
  transition:fly={{ x: 500, duration: 500 }}
>
  {#if notification.type === 'error'}
    <Error {notification} />
  {/if}
  {#if notification.type === 'success'}
    <Success {notification} />
  {/if}
</div>

<style>
  .message {
    cursor: pointer;
  }
</style>
