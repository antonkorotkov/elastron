<script>
	import SecurityTabs from './SecurityTabs.svelte'

	let { children } = $props()
</script>

<SecurityTabs />

{@render children?.()}
