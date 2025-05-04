<script>
	import { useStoreon } from "@storeon/svelte"
	import { isThemeToggleChecked } from "../../utils/helpers"

	const { app } = useStoreon('app')
	let { loading, label, onClick, color } = $props()
	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<button
	class="ui tiny basic button {color}"
	class:loading
	class:inverted
	onclick={onClick}
>
	{label}
</button>
