<script>
	import MonitoringLayout from '$lib/workspace/monitoring/MonitoringLayout.svelte'

	let { children } = $props()
</script>

<MonitoringLayout>
	{@render children()}
</MonitoringLayout>
