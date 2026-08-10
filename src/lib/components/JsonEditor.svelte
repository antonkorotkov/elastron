<script>
	import { onMount, onDestroy } from 'svelte'
	import isEqual from 'lodash/isEqual'

	/** @type {any} Reactive value to display/edit in the editor */
	let {
		value = null,
		options = {},
		editor = $bindable(null),
		id = '',
		/** @type {(error: Error) => void} Reports failures the editor cannot recover from */
		onError = () => {},
	} = $props()

	let container = $state()
	let lastApplied = null

	onMount(async () => {
		try {
			const { default: JSONEditor } = await import('jsoneditor')

			if (container) {
				editor = new JSONEditor(container, options)
				if (value) editor.update(value)
			}
		} catch (error) {
			onError(error)
		}
	})

	$effect(() => {
		if (value && editor && value !== lastApplied) {
			const previous = lastApplied
			lastApplied = value

			if (isEqual(previous, value)) return

			try {
				if (isEqual(editor.get(), value)) return
			} catch (e) {}

			try {
				editor.update(value)
			} catch (error) {
				onError(error)
			}
		}
	})

	onDestroy(() => {
		try {
			if (editor) editor.destroy()
		} catch (error) {
			onError(error)
		}
	})
</script>

<div {id} bind:this={container}></div>
