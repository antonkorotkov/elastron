<script>
	let {
		label,
		onChange,
		checked,
		disabled
	} = $props();

	const id = `log-${label.toLowerCase()}`
</script>

<div class="ui checkbox">
	<input {id} type="checkbox" onchange={onChange} {checked} {disabled} />
	<label for={id}>{label}</label>
</div>
