<script>
	import { onMount, onDestroy } from 'svelte'

	/** @type {any} Reactive value to display/edit in the editor */
	let { value = null, options = {}, editor = $bindable(null), id = '' } = $props()

	let container = $state()

	onMount(async () => {
		const { default: JSONEditor } = await import('jsoneditor')

		if (container) {
			editor = new JSONEditor(container, options)
			if (value) editor.update(value)
		}
	})

	$effect(() => {
		try {
			if (value && editor && value !== editor.get()) {
				editor.update(value)
			}
		} catch (_) {}
	})

	onDestroy(() => {
		if (editor) editor.destroy()
	})
</script>

<div {id} bind:this={container}></div>
