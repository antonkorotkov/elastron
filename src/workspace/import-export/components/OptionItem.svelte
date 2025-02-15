<script>
	import IconButton from '../../../components/buttons/IconButton.svelte'

	let {
		name,
		value,
		onDelete = () => {},
		onChangeName = () => {},
		onChangeValue = () => {}
	} = $props();
</script>

<div class="fields">
	<div class="seven wide field">
		<input
			type="text"
			placeholder="Option Name"
			value={name}
			onchange={onChangeName}
		/>
	</div>
	<div class="eight wide field">
		<input
			type="text"
			placeholder="Option Value"
			{value}
			onchange={onChangeValue}
		/>
	</div>
	<div class="one wide field controls">
		<IconButton className="minus circle" onClick={onDelete} />
	</div>
</div>

<style>
	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
