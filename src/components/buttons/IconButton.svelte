<script>
	export let onClick,
		className,
		loading = false,
		title = ''

	const classToggle = (e, className) => {
		e.target.classList.toggle(className)
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<i
	class="icon {className}"
	class:loading
	{title}
	on:mouseover={e => classToggle(e, 'green')}
	on:focus={e => classToggle(e, 'green')}
	on:mouseout={e => classToggle(e, 'green')}
	on:blur={e => classToggle(e, 'green')}
	on:click={onClick}
	role="button"
	tabindex="0"
/>

<style>
	.icon {
		cursor: pointer;
	}
</style>
