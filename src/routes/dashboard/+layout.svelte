<script>
	import DashboardTabs from '$lib/workspace/dashboard/DashboardTabs.svelte'

	let { children } = $props()
</script>

<DashboardTabs />
{@render children()}
