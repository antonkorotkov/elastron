<script>
  import { fly } from 'svelte/transition'
  import { useStoreon } from '@storeon/svelte'
  import { onMount, onDestroy } from 'svelte'

  import Error from './Error.svelte'
  import Success from './Success.svelte'

  const { dispatch } = useStoreon()

  export let notification

  let timeout = null

  onMount(() => {
		timeout = setTimeout(() => {
      dispatch('notification/delete', notification.id)
    }, 5000)
  })
  
  onDestroy(() => {
		clearInterval(timeout);
	});
</script>

<style>
  .message {
    cursor: pointer;
  }
</style>

<div 
  on:click={() => dispatch('notification/delete', notification.id)} 
  class="ui message" 
  class:negative={notification.type === 'error'}
  class:positive={notification.type === 'success'}
  transition:fly="{{ x: 500, duration: 500 }}"
  >
  {#if notification.type === 'error'}<Error notification={notification} />{/if}
  {#if notification.type === 'success'}<Success notification={notification} />{/if}
</div>