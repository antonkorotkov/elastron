<script>
	/** Records that the dialog asked this section to save. */
	export const save = () => (globalThis.__savedSections ??= []).push('alpha')
</script>

<label for="alpha-input">Alpha value</label>
<input id="alpha-input" type="text" />
