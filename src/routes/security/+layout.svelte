<script>
	import SecurityLayout from '$lib/workspace/security/SecurityLayout.svelte'

	let { children } = $props()
</script>

<SecurityLayout>
	{@render children()}
</SecurityLayout>
