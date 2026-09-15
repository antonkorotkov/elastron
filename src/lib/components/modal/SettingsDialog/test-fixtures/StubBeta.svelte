<script>
	/** Records that the dialog asked this section to save. */
	export const save = () => (globalThis.__savedSections ??= []).push('beta')
</script>

<label for="beta-input">Beta value</label>
<input id="beta-input" type="text" />
