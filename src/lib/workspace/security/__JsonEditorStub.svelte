<script>
	/**
	 * Stands in for JsonEditor in tests, which cannot run the real one: it
	 * needs a layout engine jsdom does not have.
	 *
	 * It exposes the same `editor` binding, whose `get()` returns whatever the
	 * test put in the shared holder, falling back to the value it was given.
	 * A holder value carrying `__throw` makes `get()` throw instead, which is
	 * how the real editor reports contents it cannot parse.
	 */
	let { value = null, editor = $bindable(null) } = $props()

	const holder = globalThis.__JSON_HELD__ || (globalThis.__JSON_HELD__ = { value: null })

	editor = {
		get: () => {
			const held = holder.value
			if (held === null) return value
			if (held && typeof held === 'object' && !Array.isArray(held) && held.__throw) {
				throw new Error(held.__throw)
			}
			return held
		},
	}
</script>

<div data-testid="json-editor-stub"></div>
