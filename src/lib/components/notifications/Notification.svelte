<script>
	import { fly } from 'svelte/transition'
	import { useStoreon } from '@storeon/svelte'
	import { onMount } from 'svelte'

	import Error from './Error.svelte'
	import Success from './Success.svelte'

	const { dispatch } = useStoreon()

	let { notification } = $props();
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

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	onclick={() => dispatch('notification/delete', notification.id)}
	onmouseenter={onNotificationMouseEnter}
	onmouseleave={scheduleHide}
	class="ui message"
	class:negative={notification.type === 'error'}
	class:positive={notification.type === 'success'}
	transition:fly={{ x: 500, duration: 500 }}
	role="alert"
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
