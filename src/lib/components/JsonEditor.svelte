<script>
	import { onMount, onDestroy } from 'svelte'

	/** @type {any} Reactive value to display/edit in the editor */
	let { value = null, options = {}, editor = $bindable(null), id = '' } = $props()

	let container = $state()
	let lastApplied = null

	onMount(async () => {
		const { default: JSONEditor } = await import('jsoneditor')

		if (container) {
			editor = new JSONEditor(container, options)
			if (value) editor.update(value)
		}
	})

	$effect(() => {
		if (value && editor && value !== lastApplied) {
			editor.update(value)
			lastApplied = value
		}
	})

	onDestroy(() => {
		if (editor) editor.destroy()
	})
</script>

<div {id} bind:this={container}></div>
