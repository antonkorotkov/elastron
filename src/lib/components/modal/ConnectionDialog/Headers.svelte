<script>
	import IconButton from '../../../components/buttons/IconButton.svelte'
	import HeaderItem from './HeaderItem.svelte'

	let {
		onAdd,
		onDelete,
		onChange,
		headers
	} = $props();
</script>

<div class="headers">
	{#each headers as header, index}
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
