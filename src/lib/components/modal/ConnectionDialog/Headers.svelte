<script>
	import IconButton from '../../../components/buttons/IconButton.svelte'
	import HeaderItem from './HeaderItem.svelte'

	let { onAdd, onDelete, onChange, headers } = $props()
</script>

<div class="headers">
	{#each headers as header, index (index)}
		<HeaderItem
			name={header.name}
			value={header.value}
			onDelete={() => onDelete(index)}
			onChangeName={e => onChange({ index, field: 'name' }, e.target.value)}
			onChangeValue={e => onChange({ index, field: 'value' }, e.target.value)}
		/>
	{/each}

	<IconButton className="plus circle" onClick={onAdd} />
</div>

<style>
	.headers {
		margin-top: 0.5rem;
		padding: 0.75rem;
		border-left: 3px solid rgba(100, 100, 100, 0.3);
		margin-bottom: 0.5rem;
		padding-right: 0;
	}
</style>
