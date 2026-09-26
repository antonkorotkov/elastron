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

	// Once torn down, the underlying editor's internals are nulled out. Calling
	// into it then throws from deep inside it, so nothing may touch it after.
	let destroyed = false

	/**
	 * Pushes a value into the editor.
	 *
	 * A failure here is never the user's doing: the value came from the caller
	 * as a JavaScript object, not from anything typed. It is also what happens
	 * when the editor has already been torn down, which reports itself as
	 * "this._debouncedValidate is not a function" in code mode and
	 * "Cannot read properties of null (reading 'deepEqual')" in tree mode.
	 * Neither is something to put in front of a user, so it is logged.
	 */
	const applyValue = next => {
		if (!editor || destroyed) return
		try {
			editor.update(next)
		} catch (error) {
			console.warn('JSON editor could not take the value it was given', error)
		}
	}

	onMount(async () => {
		try {
			const { default: JSONEditor } = await import('jsoneditor')

			// The import is awaited, so the component can be gone by now.
			// Creating an editor then would leak one into a detached node.
			if (destroyed || !container) return

			editor = new JSONEditor(container, options)
			if (value) applyValue(value)
		} catch (error) {
			// Only a failure to create the editor is worth surfacing: without
			// one there is nothing to edit.
			onError(error)
		}
	})

	$effect(() => {
		if (value && editor && !destroyed && value !== lastApplied) {
			const previous = lastApplied
			lastApplied = value

			if (isEqual(previous, value)) return

			try {
				if (isEqual(editor.get(), value)) return
			} catch (e) {}

			applyValue(value)
		}
	})

	onDestroy(() => {
		destroyed = true
		const dying = editor
		// The caller binds this; leaving a torn-down instance behind invites it
		// to call into internals that are no longer there.
		editor = null
		try {
			if (dying) dying.destroy()
		} catch (error) {
			/*
			 * Tearing down is not something the user can act on, and the editor
			 * is going away regardless. Reporting it through `onError` put
			 * messages from the editor's own internals, such as
			 * "_debouncedValidate is not a function", in front of the user as
			 * though their input were at fault. Only a failure to create the
			 * editor reaches `onError`.
			 */
			console.warn('JSON editor failed to tear down cleanly', error)
		}
	})
</script>

<div {id} bind:this={container}></div>
